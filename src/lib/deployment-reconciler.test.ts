import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, test } from 'node:test'
import { eq } from 'drizzle-orm'

process.env.DATABASE_URL = process.env.BOWER_TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/test'

test('reconciliation records safe, deduplicated errors including missing credentials and resumes reads', { skip: !process.env.BOWER_TEST_DATABASE_URL }, async (t) => {
  const { db } = await import('../db')
  const { organizations, projects, environments, services, serviceConfigs, deployments, deploymentEvents } = await import('../db/schema')
  const { reconcileProjectDeployments, reconcileAllDeployments } = await import('./deployment-reconciler')
  const [org] = await db.insert(organizations).values({ name: 'Operations test', slug: randomUUID(), trellisApiUrl: '', trellisApiToken: '' }).returning()
  t.after(async () => { await db.delete(organizations).where(eq(organizations.id, org.id)) })
  const [project] = await db.insert(projects).values({ orgId: org.id, name: 'Operations', slug: 'operations' }).returning()
  const [environment] = await db.insert(environments).values({ projectId: project.id, name: 'Test', slug: 'test', trellisNamespace: 'operations-test' }).returning()
  const [service] = await db.insert(services).values({ projectId: project.id, name: 'Web', slug: 'web' }).returning()
  await db.insert(serviceConfigs).values({ projectId: project.id, serviceId: service.id, environmentId: environment.id, image: 'unused', cpu: 100, memory: 128, resourceTier: 'small', autoRollbackSeconds: 3600 })
  const [deployment] = await db.insert(deployments).values({
    serviceId: service.id, environmentId: environment.id, imageAfter: 'unused', strategy: 'rolling', triggerType: 'manual', status: 'deploying',
    jobSpec: { name: 'web', namespace: 'operations-test', task_groups: [{ name: 'web', count: 1, tasks: [] }] },
    trellisIncarnation: 'test-incarnation', trellisVersion: 2, trellisRevision: 1,
  }).returning()
  await reconcileProjectDeployments(project.id, org.id)
  let events = await db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, deployment.id))
  assert.equal(events.length, 1, 'credential resolution must produce a deployment diagnostic, not escape the loop')
  assert.equal(events[0].type, 'reconciliation_error')
  assert.deepEqual(events[0].details, { message: 'Unable to read Trellis data. Check the connection and credentials.' })

  // A fresh failure verifies redaction independently from deduplication.
  await db.delete(deploymentEvents).where(eq(deploymentEvents.deploymentId, deployment.id))
  await db.update(organizations).set({ trellisApiUrl: 'https://disposable.invalid', trellisApiToken: 'test-token' }).where(eq(organizations.id, org.id))
  let requests = 0
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    requests++
    return new Response('upstream-sensitive-sentinel', { status: 503 })
  })
  await reconcileProjectDeployments(project.id, org.id)
  await reconcileProjectDeployments(project.id, org.id)
  events = await db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, deployment.id))
  assert.equal(requests, 2)
  assert.equal(events.length, 1)
  assert.deepEqual(events[0].details, { message: 'Trellis request failed (503).' })
  assert.doesNotMatch(JSON.stringify(events), /upstream-sensitive-sentinel/)
  fetchMock.mock.mockImplementation(async () => {
    requests++
    // Current identity but still unconverged: recovery must not invent health.
    return Response.json({ incarnation: 'test-incarnation', version: 2, revision: 1, allocations: [], desired: 1, running: 0, healthy: 0 })
  })
  await reconcileProjectDeployments(project.id, org.id)
  assert.equal(requests, 3)
  const [current] = await db.select().from(deployments).where(eq(deployments.id, deployment.id))
  assert.equal(current.status, 'deploying')
  assert.equal(current.completedAt, null)

  // Project queries can fail before there is a deployment to attach an event to.
  // Promise.allSettled must not silently discard those errors.
  const errors: unknown[][] = []
  t.mock.method(console, 'error', (...args: unknown[]) => { errors.push(args) })
  const selectMock = t.mock.method(db, 'select', () => { throw new Error('database-sensitive-sentinel') })
  await reconcileAllDeployments()
  assert.deepEqual(errors, [[
    'Bower deployment reconciliation failed:',
    { projectId: project.id, orgId: org.id, message: 'Unable to read Trellis data. Check the connection and credentials.' },
  ]])
  selectMock.mock.restore()
  await reconcileAllDeployments()
  assert.equal(requests, 4, 'a rejected project must not leave the process-local guard stuck')
  assert.equal(errors.length, 1)
})

after(async () => {
  if (!process.env.BOWER_TEST_DATABASE_URL) return
  const { db } = await import('../db')
  await db.$client.end()
})
