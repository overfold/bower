import assert from 'node:assert/strict'
import http from 'node:http'
import { after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'

process.env.DATABASE_URL = process.env.BOWER_TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/test'
const databaseTest = { skip: !process.env.BOWER_TEST_DATABASE_URL }
const serviceNotifications = import('./service-notifications')

// A fake Trellis cluster whose state the test controls.
let allocations: unknown[] = []
let jobs: unknown[] = []
const server = http.createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(path.endsWith('/allocations') ? allocations : path.endsWith('/jobs') ? jobs : {}))
})
const listening = new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as { port: number }).port)))
after(async () => {
  server.close()
  server.closeAllConnections()
  if (!process.env.BOWER_TEST_DATABASE_URL) return
  const { db } = await import('../db')
  await db.$client.end()
})

const iso = (ageMs: number, now: Date) => new Date(now.getTime() - ageMs).toISOString()
const failedAllocation = (now: Date, ageMs: number, id = 'web-1') => ({ id, job: 'web', group: 'app', namespace: 'ns', node_id: 'n1', phase: 'failed', health: 'unhealthy', draining: false, generation: 1, job_revision: 3, created_at: iso(ageMs + 1000, now), last_transition_at: iso(ageMs, now), attempt: 1, message: 'Process exited with code 1', ports: [], labels: { 'bower/service': 'web' } })
const job = (backoffMessage?: string, now = new Date()) => ({ name: 'web', revision: 3, spec: { namespace: 'ns' }, replacement_backoff: backoffMessage ? [{ group: 'app', job_revision: 3, failures: 4, last_failure_at: iso(1000, now), message: backoffMessage, next_replacement_at: iso(-30_000, now) }] : [] })

async function seed() {
  const { db } = await import('../db')
  const schema = await import('../db/schema')
  const suffix = randomUUID().slice(0, 8)
  const port = await listening
  const [user] = await db.insert(schema.users).values({ email: `incident-${suffix}@notifications-test.invalid`, name: 'Me', passwordHash: 'unused' }).returning()
  const [org] = await db.insert(schema.organizations).values({ name: 'Incidents', slug: `incidents-${suffix}`, trellisApiUrl: `http://127.0.0.1:${port}`, trellisApiToken: 'unused' }).returning()
  const [project] = await db.insert(schema.projects).values({ orgId: org.id, name: 'Shop', slug: 'shop' }).returning()
  const [environment] = await db.insert(schema.environments).values({ projectId: project.id, name: 'Production', slug: 'production', trellisNamespace: 'ns' }).returning()
  const [service] = await db.insert(schema.services).values({ projectId: project.id, name: 'Web', slug: 'web' }).returning()
  await db.insert(schema.serviceConfigs).values({ projectId: project.id, serviceId: service.id, environmentId: environment.id, image: 'registry.invalid/web:1', cpu: 100, memory: 128, resourceTier: 'small', replicas: 1, activeJobName: 'web' } as never)
  await db.insert(schema.deployments).values({ serviceId: service.id, environmentId: environment.id, imageAfter: 'registry.invalid/web:1', strategy: 'rolling', triggerType: 'manual', status: 'healthy', triggeredByUserId: user.id })
  return { db, schema, user, org, project, environment, service }
}

async function cleanup(fixture: Awaited<ReturnType<typeof seed>>) {
  await fixture.db.delete(fixture.schema.organizations).where(eq(fixture.schema.organizations.id, fixture.org.id))
  await fixture.db.delete(fixture.schema.users).where(inArray(fixture.schema.users.id, [fixture.user.id]))
}

test('a crash-looping service notifies once per incident, keeps its start, and resolves on recovery', databaseTest, async () => {
  const { loadServiceHealthNotifications } = await serviceNotifications
  const fixture = await seed()
  const projects = [{ id: fixture.project.id, name: 'Shop', slug: 'shop' }]
  try {
    const start = new Date('2026-10-04T10:00:00.000Z')
    const lastSeen = new Date(start.getTime() - 3_600_000)
    // The failure began 20 minutes ago; the newest allocation failed a minute ago.
    allocations = [failedAllocation(start, 20 * 60_000, 'web-old'), failedAllocation(start, 60_000, 'web-new')]
    jobs = [job('Worker could not reach database', start)]
    const first = await loadServiceHealthNotifications({ orgId: fixture.org.id, projects, lastSeenAt: lastSeen, now: start })
    assert.equal(first.items.length, 1)
    assert.equal(first.unreadCount, 1)
    assert.equal(first.items[0].cause, 'Worker could not reach database')
    assert.equal(first.items[0].serviceSlug, 'web')
    assert.equal(first.items[0].occurredAt, new Date(start.getTime() - 20 * 60_000).toISOString())
    const incidentId = first.items[0].id

    // Trellis forgets the oldest allocation: the incident and its start do not move, and nothing new is raised.
    const later = new Date(start.getTime() + 20_000)
    allocations = [failedAllocation(later, 5_000, 'web-newest')]
    const second = await loadServiceHealthNotifications({ orgId: fixture.org.id, projects, lastSeenAt: lastSeen, now: later })
    assert.deepEqual(second.items.map((item) => [item.id, item.occurredAt]), [[incidentId, first.items[0].occurredAt]])

    // Once the user has seen it, it is listed but not unread.
    const seen = await loadServiceHealthNotifications({ orgId: fixture.org.id, projects, lastSeenAt: new Date(start.getTime() + 1000), now: later })
    assert.equal(seen.unreadCount, 0)
    assert.equal(seen.items[0].unread, false)

    // Healthy again: resolved, and a later failure is a new incident with a new id.
    const healed = new Date(start.getTime() + 60_000 * 5)
    allocations = [{ ...failedAllocation(healed, 0), phase: 'running', health: 'healthy' }]
    jobs = [job(undefined, healed)]
    assert.deepEqual((await loadServiceHealthNotifications({ orgId: fixture.org.id, projects, lastSeenAt: lastSeen, now: healed })).items, [])
    const again = new Date(start.getTime() + 60_000 * 30)
    allocations = [failedAllocation(again, 1000, 'web-3')]
    const next = await loadServiceHealthNotifications({ orgId: fixture.org.id, projects, lastSeenAt: lastSeen, now: again })
    assert.equal(next.items.length, 1)
    assert.notEqual(next.items[0].id, incidentId)
  } finally {
    await cleanup(fixture)
  }
})

test('an unreadable cluster neither opens nor resolves incidents, and inaccessible projects are not listed', databaseTest, async () => {
  const { loadServiceHealthNotifications } = await serviceNotifications
  const fixture = await seed()
  try {
    const now = new Date('2026-10-04T10:00:00.000Z')
    allocations = [failedAllocation(now, 60_000)]
    jobs = [job(undefined, now)]
    const projects = [{ id: fixture.project.id, name: 'Shop', slug: 'shop' }]
    const opened = await loadServiceHealthNotifications({ orgId: fixture.org.id, projects, lastSeenAt: new Date(0), now })
    assert.equal(opened.items.length, 1)
    // No project access: nothing is listed or counted, even with an open incident.
    assert.deepEqual(await loadServiceHealthNotifications({ orgId: fixture.org.id, projects: [], lastSeenAt: new Date(0), now }), { items: [], unreadCount: 0 })
    // Cluster errors (here: every request fails) leave the incident open.
    server.close()
    server.closeAllConnections()
    const later = new Date(now.getTime() + 60_000)
    const unreadable = await loadServiceHealthNotifications({ orgId: fixture.org.id, projects, lastSeenAt: new Date(0), now: later })
    assert.equal(unreadable.items.length, 1)
  } finally {
    await cleanup(fixture)
  }
})
