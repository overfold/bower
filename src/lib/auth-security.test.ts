import 'next/dist/server/node-environment-baseline'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { eq, inArray } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store'
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external'
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external'
import { createWorkStore } from 'next/dist/server/async-storage/work-store'

process.env.DATABASE_URL = process.env.BOWER_TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/test'
const enabled = Boolean(process.env.BOWER_TEST_DATABASE_URL)

function requestStore(token?: string) {
  const request = new NextRequest('https://bower.test/settings/organization', {
    headers: token ? { cookie: `bower_session=${token}` } : {},
  })
  return createRequestStoreForAPI(request, { pathname: '/settings/organization' },
    { tags: [], expirationsByCacheKind: new Map() }, undefined, undefined, undefined)
}

function runRequest<T>(store: ReturnType<typeof requestStore>, action: () => T): T {
  const work = createWorkStore({ page: '/settings/organization/page', buildId: 'test', deploymentId: '', previouslyRevalidatedTags: [],
    renderOpts: { cacheLifeProfiles: { default: { stale: 300, revalidate: 900, expire: 3600 } }, staticPageGenerationTimeout: 60, cacheComponents: false, validationLevel: 'warning', supportsDynamicResponse: true,
      // revalidatePath records pending tags; this harness does not flush a page cache.
      incrementalCache: {} as NonNullable<ReturnType<typeof createWorkStore>['incrementalCache']>,
      waitUntil: undefined, onClose: () => {}, onAfterTaskError: undefined,
      experimental: { isRoutePPREnabled: false, authInterrupts: false, useCacheTimeout: 60 } } })
  return workAsyncStorage.run(work, () => workUnitAsyncStorage.run(store, action))
}

test('source identity ignores forwarded headers unless trusted ingress is explicitly configured', async () => {
  const { authSource } = await import('./auth-abuse')
  const previous = process.env.BOWER_AUTH_SOURCE_HEADER
  try {
    delete process.env.BOWER_AUTH_SOURCE_HEADER
    assert.equal(authSource(new Headers({ 'x-forwarded-for': '192.0.2.1', 'x-real-ip': '192.0.2.2' })), 'unknown')
    process.env.BOWER_AUTH_SOURCE_HEADER = 'x-trusted-source'
    assert.equal(authSource(new Headers({ 'x-trusted-source': '192.0.2.3' })), '192.0.2.3')
    assert.equal(authSource(new Headers({ 'x-trusted-source': '192.0.2.3, 192.0.2.4' })), 'unknown')
    assert.equal(authSource(new Headers({ 'x-trusted-source': 'not-an-ip' })), 'unknown')
  } finally {
    if (previous === undefined) delete process.env.BOWER_AUTH_SOURCE_HEADER
    else process.env.BOWER_AUTH_SOURCE_HEADER = previous
  }
})

test('shared admission limits changing scopes, concurrent bcrypt work, and expires stale state', { skip: !enabled }, async () => {
  const { db } = await import('../db')
  const { authAbuseBuckets } = await import('../db/schema')
  const { consumeAuthAttempt, acquirePasswordWork } = await import('./auth-abuse')
  const { hashPassword, verifyPassword, PasswordWorkBusyError } = await import('./auth')
  // This test requires a dedicated disposable test database: counters are global.
  await db.delete(authAbuseBuckets)
  const previousSourceHeader = process.env.BOWER_AUTH_SOURCE_HEADER
  try {
    const headers = new Headers()
    const attempts = await Promise.all(Array.from({ length: 11 }, () => consumeAuthAttempt(headers, 'login:one')))
    assert.equal(attempts.filter(Boolean).length, 10)
    await db.delete(authAbuseBuckets)
    for (let index = 0; index < 30; index++) assert.equal(await consumeAuthAttempt(headers, `route-password:${index}`), true)
    assert.equal(await consumeAuthAttempt(headers, 'route-password:different'), false)
    await db.update(authAbuseBuckets).set({ expiresAt: new Date(0) })
    assert.equal(await consumeAuthAttempt(headers, 'route-password:different'), true)

    process.env.BOWER_AUTH_SOURCE_HEADER = 'x-trusted-source'
    const source = (index: number) => new Headers({ 'x-trusted-source': `198.51.100.${index % 256}` })
    await db.delete(authAbuseBuckets)
    for (let index = 0; index < 50; index++) assert.equal(await consumeAuthAttempt(source(index), 'route-password:shared'), true)
    assert.equal(await consumeAuthAttempt(source(50), 'route-password:shared'), false, 'route-wide limit must bound distributed sources')
    await db.delete(authAbuseBuckets)
    for (let index = 0; index < 150; index++) assert.equal(await consumeAuthAttempt(source(index), `route-password:${index}`), true)
    assert.equal(await consumeAuthAttempt(source(150), 'route-password:another'), false, 'family limit must bound changing routes and sources')
    await db.delete(authAbuseBuckets)
    for (let index = 0; index < 300; index++) assert.equal(await consumeAuthAttempt(source(index), `${['login', 'register', 'route-password'][index % 3]}:${index}`), true)
    assert.equal(await consumeAuthAttempt(source(301), 'login:another'), false, 'global limit must bound changing authentication families')
    const bucketCount = (await db.select().from(authAbuseBuckets)).length
    for (let index = 0; index < 20; index++) assert.equal(await consumeAuthAttempt(source(index), `register:rejected-${index}`), false)
    assert.equal((await db.select().from(authAbuseBuckets)).length, bucketCount, 'rejected global attempts must not create new scope rows')

    const releases = await Promise.all(Array.from({ length: 8 }, () => acquirePasswordWork()))
    assert.equal(releases.filter(Boolean).length, 4)
    await assert.rejects(hashPassword('valid-password'), PasswordWorkBusyError)
    await Promise.all(releases.map((release) => release?.()))
    const hash = await hashPassword('é'.repeat(36))
    assert.equal(await verifyPassword('é'.repeat(36), hash), true)
    assert.equal(await verifyPassword('wrong-password', hash), false)
    await assert.rejects(hashPassword('é'.repeat(37)), /72 UTF-8 bytes/)
    assert.equal((await db.select().from(authAbuseBuckets)).some((row) => row.key.startsWith('password-work:')), false)
  } finally {
    await db.delete(authAbuseBuckets)
    if (previousSourceHeader === undefined) delete process.env.BOWER_AUTH_SOURCE_HEADER
    else process.env.BOWER_AUTH_SOURCE_HEADER = previousSourceHeader
  }
})

test('API keys require current membership and canonical direct/team roles; offboarding preserves other orgs', { skip: !enabled }, async () => {
  const { db } = await import('../db')
  const { users, organizations, organizationMembers, projects, services, teams, teamMemberships, teamProjectAccess, projectUserAccess, apiKeys } = await import('../db/schema')
  const { authenticateApiKey } = await import('./api-auth')
  const { revokeOrganizationMembership } = await import('./organization-members')
  const [user] = await db.insert(users).values({ name: 'Security test', email: `${randomUUID()}@security.invalid`, passwordHash: 'unused' }).returning()
  const orgIds: string[] = []
  try {
    const fixtures = []
    for (let index = 0; index < 2; index++) {
      const [org] = await db.insert(organizations).values({ name: 'Security test', slug: randomUUID(), trellisApiUrl: '', trellisApiToken: '' }).returning()
      orgIds.push(org.id)
      const [membership] = await db.insert(organizationMembers).values({ orgId: org.id, userId: user.id, role: 'member' }).returning()
      const [project] = await db.insert(projects).values({ orgId: org.id, name: 'Test', slug: 'test' }).returning()
      const [service] = await db.insert(services).values({ projectId: project.id, name: 'Test', slug: 'test' }).returning()
      const [team] = await db.insert(teams).values({ orgId: org.id, name: 'Test' }).returning()
      await db.insert(teamMemberships).values({ teamId: team.id, userId: user.id })
      await db.insert(teamProjectAccess).values({ teamId: team.id, projectId: project.id, role: 'deployer' })
      await db.insert(projectUserAccess).values({ projectId: project.id, userId: user.id, role: 'viewer' })
      const token = randomUUID()
      await db.insert(apiKeys).values({ orgId: org.id, userId: user.id, name: 'Test', keyPrefix: 'test', keyHash: createHash('sha256').update(token).digest('hex') })
      fixtures.push({ membership, project, service, team, token })
    }
    const [target, unrelated] = fixtures
    const authenticate = () => authenticateApiKey(`Bearer ${target.token}`, target.service.id)
    assert.ok(await authenticate())
    for (const scope of ['read', 'restart', 'rollback'] as const) {
      assert.equal(await authenticateApiKey(`Bearer ${target.token}`, target.service.id, undefined, scope), null, 'legacy keys remain deploy-only')
    }
    await db.delete(organizationMembers).where(eq(organizationMembers.id, target.membership.id))
    assert.equal(await authenticate(), null, 'surviving team grant must not authorize a removed member')
    await db.insert(organizationMembers).values(target.membership)
    await db.delete(teamMemberships).where(eq(teamMemberships.teamId, target.team.id))
    assert.equal(await authenticate(), null, 'viewer direct grant is not deploy access')
    await db.update(projectUserAccess).set({ role: 'deployer' }).where(eq(projectUserAccess.projectId, target.project.id))
    assert.ok(await authenticate(), 'direct deployer grants must work')
    await db.delete(projectUserAccess).where(eq(projectUserAccess.projectId, target.project.id))
    assert.equal(await authenticate(), null, 'removed direct grant must take effect')
    await db.update(users).set({ isInstanceAdmin: true }).where(eq(users.id, user.id))
    assert.equal(await authenticate(), null, 'explicit member role remains authoritative for instance admins')
    await db.delete(organizationMembers).where(eq(organizationMembers.id, target.membership.id))
    assert.ok(await authenticate(), 'instance admins deliberately receive synthetic owner access without membership')
    await db.update(users).set({ isInstanceAdmin: false }).where(eq(users.id, user.id))
    await db.insert(organizationMembers).values(target.membership)
    await db.insert(projectUserAccess).values({ projectId: target.project.id, userId: user.id, role: 'admin' })
    await db.insert(teamMemberships).values({ teamId: target.team.id, userId: user.id })
    await revokeOrganizationMembership(target.membership)
    assert.equal(await authenticate(), null)
    assert.equal((await db.select().from(apiKeys).where(eq(apiKeys.orgId, orgIds[0]))).length, 0)
    assert.equal((await db.select().from(teamMemberships).where(eq(teamMemberships.teamId, target.team.id))).length, 0)
    assert.equal((await db.select().from(projectUserAccess).where(eq(projectUserAccess.projectId, target.project.id))).length, 0)
    assert.ok(await authenticateApiKey(`Bearer ${unrelated.token}`, unrelated.service.id))
    assert.equal((await db.select().from(projectUserAccess).where(eq(projectUserAccess.projectId, unrelated.project.id))).length, 1)
    assert.equal((await db.select().from(organizationMembers).where(eq(organizationMembers.id, unrelated.membership.id))).length, 1)
    assert.equal((await db.select().from(teamProjectAccess).where(eq(teamProjectAccess.teamId, target.team.id))).length, 1, 'team-wide grants must remain for other members')
  } finally {
    await db.delete(organizations).where(inArray(organizations.id, orgIds))
    await db.delete(users).where(eq(users.id, user.id))
  }
})

test('application automation scopes diagnosis, deploy and recovery and preserves key attribution', { skip: !enabled }, async (t) => {
  const { db } = await import('../db')
  const { users, organizations, organizationMembers, projects, environments, services, serviceConfigs, projectUserAccess, apiKeys, deployments, auditLog } = await import('../db/schema')
  const { createSession } = await import('./auth')
  const automation = await import('../app/api/v1/automation/route')
  const legacy = await import('../app/api/deploy/route')
  const credentials = await import('../app/api/v1/credentials/route')
  let upstreamFailure = false
  let restarts = 0
  const pins = { 'docker.io/library/app:v1': `docker.io/library/app@sha256:${'a'.repeat(64)}` }
  const appliedPins: unknown[] = []
  const writes: Array<{ task_groups: Array<{ tasks: Array<{ image: string }> }> }> = []
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, 'http://trellis.test')
    response.setHeader('Content-Type', 'application/json')
    if (upstreamFailure) { response.writeHead(500).end(JSON.stringify({ error: 'secret upstream credentials https://private.invalid' })); return }
    if (request.method === 'POST') {
      assert.equal(url.pathname.startsWith('/v1/namespaces/allowed/'), true)
      if (url.pathname.endsWith('/restart')) {
        assert.equal(url.pathname, '/v1/namespaces/allowed/jobs/app/restart')
        restarts++
        response.end('{}'); return
      }
      let body = ''
      for await (const chunk of request) body += chunk
      const { spec, resolved_images } = JSON.parse(body)
      if (url.pathname.endsWith('/plan')) response.end(JSON.stringify({ action: 'create', namespace: 'allowed', job: spec.name, spec }))
      else { writes.push(spec); appliedPins.push(resolved_images); response.end(JSON.stringify({ namespace: 'allowed', name: spec.name, incarnation: 'incarnation', version: 1, revision: 1 })) }
    } else if (url.pathname === '/v1/namespaces/allowed/jobs/app') {
      response.end(JSON.stringify({ incarnation: 'incarnation', version: 1, revision: 1 }))
    } else if (url.pathname.endsWith('/allocations')) {
      response.end(JSON.stringify([
        { id: 'owned', namespace: 'allowed', job: 'app-blue', phase: 'running', health: 'healthy', tasks: ['app'], labels: {}, created_at: '2026-10-18T00:00:00Z', last_transition_at: '2026-10-18T00:01:00Z' },
        { id: 'other-service', namespace: 'allowed', job: 'worker', labels: {} },
        { id: 'other-environment', namespace: 'denied', job: 'app-blue', labels: { 'bower/service': 'app' } },
      ]))
    } else if (url.pathname.endsWith('/logs')) {
      assert.equal(url.pathname, '/v1/namespaces/allowed/allocations/owned/logs')
      assert.equal(url.searchParams.get('tail'), '200')
      response.setHeader('Content-Type', 'text/plain'); response.end('application diagnostic log\n')
    } else if (url.pathname.endsWith('/metrics')) {
      assert.equal(url.pathname, '/v1/namespaces/allowed/allocations/owned/metrics')
      response.end(JSON.stringify([{ task: 'app', cpu_usage_nanoseconds: 123, memory_usage_bytes: 456, collected_at: '2026-10-18T00:02:00Z' }]))
    } else response.writeHead(404).end('{}')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })
  const port = (server.address() as { port: number }).port
  const [user] = await db.insert(users).values({ name: 'Automation test', email: `${randomUUID()}@automation.invalid`, passwordHash: 'unused' }).returning()
  const [org] = await db.insert(organizations).values({ name: 'Automation', slug: randomUUID(), trellisApiUrl: `http://127.0.0.1:${port}`, trellisApiToken: 'synthetic-cluster-token' }).returning()
  try {
    await db.insert(organizationMembers).values({ orgId: org.id, userId: user.id, role: 'member' })
    const [project, otherProject] = await db.insert(projects).values([{ orgId: org.id, name: 'Allowed', slug: 'allowed' }, { orgId: org.id, name: 'Denied', slug: 'denied' }]).returning()
    const [environment, otherEnvironment, foreignEnvironment] = await db.insert(environments).values([
      { projectId: project.id, name: 'Allowed', slug: 'allowed', trellisNamespace: 'allowed', envVars: { SECRET: 'secret-reference' } },
      { projectId: project.id, name: 'Denied', slug: 'denied', trellisNamespace: 'denied' },
      { projectId: otherProject.id, name: 'Foreign', slug: 'foreign', trellisNamespace: 'foreign' },
    ]).returning()
    const [service, otherService] = await db.insert(services).values([{ projectId: project.id, name: 'App', slug: 'app' }, { projectId: otherProject.id, name: 'App', slug: 'app' }]).returning()
    await db.insert(serviceConfigs).values({ projectId: project.id, serviceId: service.id, environmentId: environment.id, image: 'app:v1', cpu: 100, memory: 128, resourceTier: 'small', activeJobName: 'app-blue', envVars: { PRIVATE: 'private-config-value' } })
    await db.insert(projectUserAccess).values({ projectId: project.id, userId: user.id, role: 'viewer' })
    const [release] = await db.insert(deployments).values({ serviceId: service.id, environmentId: environment.id, imageAfter: 'app:v1', status: 'healthy', strategy: 'rolling', triggerType: 'manual', jobSpec: { secret: 'private-config-value' }, planDiff: { private: 'private-plan-value' } }).returning()
    await db.insert(deployments).values({ serviceId: service.id, environmentId: otherEnvironment.id, imageAfter: 'app:forbidden', status: 'failed', strategy: 'rolling', triggerType: 'manual' })
    const session = await createSession(user.id)
    const store = requestStore(session.token)
    const { buildJobSpec } = await import('./job-builder')
    const historicalSpec = buildJobSpec({ name: 'app-blue', namespace: 'allowed', image: 'app:v1', cpu: 100, memory: 128, replicas: 1, deploymentStrategy: 'rolling', envVars: { PRIVATE: 'private-config-value' }, secrets: [], labels: {}, volumes: [] })
    await db.update(deployments).set({ jobSpec: historicalSpec, planDiff: { resolved_images: pins }, createdAt: new Date(Date.now() - 60_000) }).where(eq(deployments.id, release.id))
    const issue = (overrides = {}) => runRequest(store, () => credentials.POST(new Request('https://bower.test/api/v1/credentials', {
      method: 'POST', headers: { origin: 'https://bower.test' }, body: JSON.stringify({ name: 'Diagnosis', projectId: project.id, environmentId: environment.id, scopes: ['read'], expiresAt: new Date(Date.now() + 3600_000).toISOString(), ...overrides }),
    })))
    assert.equal((await issue({ scopes: ['deploy'] })).status, 400, 'viewer cannot mint deploy access')
    for (const scope of ['restart', 'rollback']) assert.equal((await issue({ scopes: [scope] })).status, 400, `viewer cannot mint ${scope} access`)
    assert.equal((await issue({ expiresAt: new Date(Date.now() + 31 * 86400_000).toISOString() })).status, 400)
    assert.equal((await issue({ expiresAt: new Date(0).toISOString() })).status, 400)
    assert.equal((await issue({ environmentId: foreignEnvironment.id })).status, 400)
    assert.equal((await issue({ scopes: ['admin'] })).status, 400)
    assert.equal((await credentials.POST(new Request('https://bower.test/api/v1/credentials', { method: 'POST', headers: { origin: 'https://evil.test' } }))).status, 403)
    const issued = await issue()
    assert.equal(issued.status, 201)
    const key = await issued.json()
    const bearerOnly = new Request('https://bower.test/api/v1/credentials', { method: 'POST', headers: { origin: 'https://bower.test', authorization: `Bearer ${key.token}` } })
    assert.equal((await runRequest(requestStore(), () => credentials.POST(bearerOnly))).status, 401)
    const read = (operation: string, overrides = {}, token = key.token) => automation.GET(new Request(`https://bower.test/api/v1/automation?${new URLSearchParams({ operation, projectId: project.id, serviceId: service.id, environmentId: environment.id, allocationId: 'owned', ...overrides })}`, { headers: { authorization: `Bearer ${token}` } }))
    const deploy = (token: string, overrides = {}, handler = automation.POST) => handler(new Request('https://bower.test/api/v1/automation', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ serviceId: service.id, environmentId: environment.id, image: 'app:v2', ...overrides }) }))
    const recover = (operation: string, token: string, overrides = {}) => runRequest(requestStore(), () => automation.PATCH(new Request('https://bower.test/api/v1/automation', { method: 'PATCH', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ operation, serviceId: service.id, environmentId: environment.id, targetDeploymentId: release.id, ...overrides }) })))
    const stored = (await db.select().from(apiKeys).where(eq(apiKeys.id, key.id)))[0]
    assert.notEqual(stored.keyHash, key.token)
    assert.equal(stored.projectId, project.id)
    assert.equal(stored.environmentId, environment.id)
    assert.ok(stored.expiresAt)
    const beforeReads = (await db.select().from(auditLog).where(eq(auditLog.orgId, org.id))).length
    assert.deepEqual((await (await read('projects')).json()).projects, [{ id: project.id, name: 'Allowed', slug: 'allowed' }])
    assert.deepEqual((await (await read('environments')).json()).environments, [{ id: environment.id, projectId: project.id, name: 'Allowed', slug: 'allowed' }])
    assert.deepEqual((await (await read('services')).json()).services, [{ id: service.id, projectId: project.id, name: 'App', slug: 'app' }])
    const history = await (await read('deployments')).json()
    assert.deepEqual(history.deployments.map((item: { id: string }) => item.id), [release.id])
    assert.equal(JSON.stringify(history).includes('private-'), false)
    const allocations = await (await read('allocations')).json()
    assert.deepEqual(allocations.allocations.map((item: { id: string }) => item.id), ['owned'])
    assert.equal((await read('logs')).headers.get('cache-control'), 'no-store')
    assert.deepEqual(await (await read('logs')).json(), { logs: 'application diagnostic log\n' })
    assert.deepEqual(await (await read('metrics')).json(), { metrics: [{ allocationId: 'owned', task: 'app', cpuUsageNanoseconds: 123, memoryUsageBytes: 456, collectedAt: '2026-10-18T00:02:00Z' }] })
    for (const operation of ['deployments', 'allocations', 'logs', 'metrics']) {
      assert.equal((await read(operation, { environmentId: otherEnvironment.id })).status, 403)
      assert.equal((await read(operation, { serviceId: otherService.id })).status, 403)
      assert.equal((await read(operation, { environmentId: foreignEnvironment.id })).status, 403)
    }
    assert.equal((await read('environments', { projectId: otherProject.id })).status, 403)
    assert.equal((await read('logs', { allocationId: 'other-service' })).status, 404)
    assert.equal((await read('metrics', { allocationId: 'other-environment' })).status, 404)
    assert.equal((await read('logs', { serviceId: 'malformed' })).status, 400)
    assert.equal((await read('restart')).status, 400)
    assert.equal((await read('projects', {}, 'invalid')).status, 401)
    assert.equal((await db.select().from(auditLog).where(eq(auditLog.orgId, org.id))).length, beforeReads, 'diagnosis is unaudited, matching interactive reads')
    assert.equal((await deploy(key.token)).status, 403)
    await db.update(projectUserAccess).set({ role: 'deployer' }).where(eq(projectUserAccess.projectId, project.id))
    assert.equal((await deploy(key.token)).status, 403, 'role elevation cannot widen a read-only key')
    const deployKey = await (await issue({ scopes: ['deploy'] })).json()
    assert.equal((await read('projects', {}, deployKey.token)).status, 403)
    assert.equal((await deploy(deployKey.token, { environmentId: otherEnvironment.id }, legacy.POST)).status, 403)
    assert.equal(writes.length, 0, 'denied operations must not reach Trellis')
    const accepted = await deploy(deployKey.token)
    assert.equal(accepted.status, 202, await accepted.clone().text())
    const deployment = await accepted.json()
    assert.equal(deployment.accepted, true)
    assert.equal(writes.length, 1)
    assert.equal(writes[0].task_groups[0].tasks[0].image, 'docker.io/library/app:v2')
    const [recorded] = await db.select().from(deployments).where(eq(deployments.id, deployment.deploymentId))
    assert.equal(recorded.imageAfter, 'app:v2')
    assert.equal(recorded.environmentId, environment.id)
    const audit = (await db.select().from(auditLog).where(eq(auditLog.resourceId, deployment.deploymentId)))[0]
    assert.equal(audit.actorType, 'api_key')
    assert.equal(audit.apiKeyId, deployKey.id)
    assert.equal(audit.userId, user.id)
    await db.update(serviceConfigs).set({ activeJobName: 'app' }).where(eq(serviceConfigs.serviceId, service.id))
    const restartKey = await (await issue({ scopes: ['restart'] })).json()
    const rollbackKey = await (await issue({ scopes: ['rollback'] })).json()
    for (const operation of ['restart', 'rollback']) {
      assert.equal((await recover(operation, key.token)).status, 403)
      assert.equal((await recover(operation, deployKey.token)).status, 403, 'deploy scope grants no recovery access')
      const token = operation === 'restart' ? restartKey.token : rollbackKey.token
      assert.equal((await recover(operation, token, { environmentId: otherEnvironment.id })).status, 403)
      assert.equal((await recover(operation, token, { serviceId: otherService.id })).status, 403)
      assert.equal((await recover(operation, 'invalid')).status, 401)
    }
    assert.equal((await recover('rollback', restartKey.token)).status, 403)
    assert.equal((await recover('restart', rollbackKey.token)).status, 403)
    assert.equal((await recover('rollback', rollbackKey.token, { targetDeploymentId: undefined })).status, 400)
    assert.equal((await recover('rollback', rollbackKey.token, { targetDeploymentId: randomUUID() })).status, 400)
    await db.update(deployments).set({ status: 'healthy' }).where(eq(deployments.id, recorded.id))
    assert.equal((await recover('rollback', rollbackKey.token, { targetDeploymentId: recorded.id })).status, 400, 'cannot restore the running release')
    await db.update(deployments).set({ planDiff: null }).where(eq(deployments.id, release.id))
    assert.equal((await recover('rollback', rollbackKey.token)).status, 400, 'cannot restore unpinned images')
    await db.update(deployments).set({ planDiff: { resolved_images: pins }, createdAt: new Date(Date.now() + 60_000) }).where(eq(deployments.id, release.id))
    assert.equal((await recover('rollback', rollbackKey.token)).status, 400, 'cannot restore a newer release')
    await db.update(deployments).set({ createdAt: new Date(Date.now() - 60_000) }).where(eq(deployments.id, release.id))
    assert.equal(writes.length, 1, 'invalid recovery must not apply a job')
    assert.equal(restarts, 0)
    const restarted = await recover('restart', restartKey.token)
    assert.equal(restarted.status, 202, await restarted.clone().text())
    assert.deepEqual(await restarted.json(), { accepted: true, operation: 'restart' })
    assert.equal(restarts, 1)
    const restartAudit = (await db.select().from(auditLog).where(eq(auditLog.resourceId, service.id))).find((entry) => entry.action === 'service.restarted')!
    assert.equal(restartAudit.apiKeyId, restartKey.id)
    assert.equal(restartAudit.actorType, 'api_key')
    assert.equal(restartAudit.userId, user.id)
    const rolledBack = await recover('rollback', rollbackKey.token)
    assert.equal(rolledBack.status, 202, await rolledBack.clone().text())
    const rollback = await rolledBack.json()
    assert.equal(rollback.operation, 'rollback')
    assert.equal(rollback.accepted, true)
    assert.equal(writes.length, 2)
    assert.equal(writes[1].task_groups[0].tasks[0].image, 'docker.io/library/app:v1')
    assert.deepEqual(appliedPins[1], pins, 'rollback applies the historical digest, not the current tag')
    const rollbackAudit = (await db.select().from(auditLog).where(eq(auditLog.resourceId, rollback.deploymentId)))[0]
    assert.equal(rollbackAudit.action, 'service.rollback.requested')
    assert.equal(rollbackAudit.actorType, 'api_key')
    assert.equal(rollbackAudit.apiKeyId, rollbackKey.id)
    assert.equal(rollbackAudit.userId, user.id)
    assert.equal((rollbackAudit.details as { targetDeploymentId: string }).targetDeploymentId, release.id)
    await db.update(projectUserAccess).set({ role: 'viewer' }).where(eq(projectUserAccess.projectId, project.id))
    assert.equal((await deploy(deployKey.token)).status, 403, 'role downgrade takes effect immediately')
    assert.equal((await recover('restart', restartKey.token)).status, 403)
    assert.equal((await recover('rollback', rollbackKey.token)).status, 403)
    upstreamFailure = true
    const failed = await read('logs')
    assert.equal(failed.status, 502)
    assert.equal((await failed.text()).includes('private.invalid'), false)
    upstreamFailure = false
    await db.update(apiKeys).set({ expiresAt: new Date(0) }).where(eq(apiKeys.id, key.id))
    assert.equal((await read('projects')).status, 401)
    assert.equal((await deploy(key.token, {}, legacy.POST)).status, 401)
    assert.equal((await recover('restart', key.token)).status, 401)
    const revoked = await runRequest(store, () => credentials.DELETE(new Request(`https://bower.test/api/v1/credentials?id=${deployKey.id}`, { method: 'DELETE', headers: { origin: 'https://bower.test' } })))
    assert.equal(revoked.status, 204)
    assert.equal((await deploy(deployKey.token)).status, 401)
    assert.equal((await recover('rollback', deployKey.token)).status, 401)
    const revocations = await db.select().from(auditLog).where(eq(auditLog.resourceId, deployKey.id))
    assert.ok(revocations.some((entry) => entry.action === 'api_key.revoked' && entry.orgId === org.id))
  } finally {
    await db.delete(organizations).where(eq(organizations.id, org.id))
    await db.delete(users).where(eq(users.id, user.id))
  }
})

test('password replacement revokes all old sessions, rotates current session, and rejects stale login races', { skip: !enabled }, async () => {
  const { db } = await import('../db')
  const { users } = await import('../db/schema')
  const { createSession, validateSession, replacePasswordAndSessions } = await import('./auth')
  const [user] = await db.insert(users).values({ name: 'Session test', email: `${randomUUID()}@security.invalid`, passwordHash: 'old-hash' }).returning()
  try {
    const current = await createSession(user.id, 'old-hash')
    const stolen = await createSession(user.id, 'old-hash')
    assert.ok(await validateSession(stolen.token))
    assert.equal(await replacePasswordAndSessions(user.id, 'wrong-hash', 'new-hash'), null)
    assert.ok(await validateSession(current.token))
    const replacement = await replacePasswordAndSessions(user.id, 'old-hash', 'new-hash')
    assert.ok(replacement)
    assert.notEqual(replacement.token, current.token)
    assert.equal(await validateSession(current.token), null)
    assert.equal(await validateSession(stolen.token), null)
    assert.equal((await validateSession(replacement.token))?.user.id, user.id)
    await assert.rejects(createSession(user.id, 'old-hash'), /Credentials changed/)
  } finally { await db.delete(users).where(eq(users.id, user.id)) }
})

test('organization client props never contain durable tokens; password action verifies, rotates, and audits', { skip: !enabled }, async () => {
  const { db } = await import('../db')
  const { users, organizations, organizationMembers, auditLog } = await import('../db/schema')
  const { hashPassword, createSession, validateSession } = await import('./auth')
  const { updateOrganizationAction, changePasswordAction } = await import('./actions/settings')
  const { default: OrganizationPage } = await import('../app/(dashboard)/settings/organization/page')
  const { ClusterSettingsForm } = await import('../components/cluster-settings-form')
  const passwordHash = await hashPassword('Current-password-123')
  const [user] = await db.insert(users).values({ name: 'Action test', email: `${randomUUID()}@security.invalid`, passwordHash }).returning()
  const durableToken = `synthetic-durable-${randomUUID()}`
  const [org] = await db.insert(organizations).values({ name: 'Test', slug: randomUUID(), trellisApiUrl: 'https://cluster.invalid', trellisApiToken: durableToken }).returning()
  const [membership] = await db.insert(organizationMembers).values({ orgId: org.id, userId: user.id, role: 'member' }).returning()
  const session = await createSession(user.id)
  const stale = await createSession(user.id)
  try {
    const store = requestStore(session.token)
    const memberPage = await runRequest(store, OrganizationPage)
    assert.equal(JSON.stringify(memberPage).includes(durableToken), false)
    assert.equal(memberPage.props.children[2], false)
    const replacementForm = new FormData()
    replacementForm.set('trellisApiToken', 'replacement-token')
    assert.equal((await runRequest(store, () => updateOrganizationAction(replacementForm))).error, 'Insufficient permissions.')
    await db.update(organizationMembers).set({ role: 'admin' }).where(eq(organizationMembers.id, membership.id))
    const adminPage = await runRequest(store, OrganizationPage)
    assert.equal(JSON.stringify(adminPage).includes(durableToken), false)
    const clientElement = adminPage.props.children[2].props.children
    assert.equal(clientElement.type, ClusterSettingsForm)
    assert.deepEqual(clientElement.props.org, { trellisApiUrl: 'https://cluster.invalid', tokenConfigured: true, workloadIdentity: false })
    const blank = new FormData()
    blank.set('trellisApiToken', '')
    assert.equal((await runRequest(store, () => updateOrganizationAction(blank))).success, true)
    assert.equal((await db.select().from(organizations).where(eq(organizations.id, org.id)))[0].trellisApiToken, durableToken)
    const passwordForm = new FormData()
    passwordForm.set('currentPassword', 'incorrect')
    passwordForm.set('newPassword', 'Replacement-password-456')
    assert.ok((await runRequest(store, () => changePasswordAction(passwordForm))).fieldErrors?.currentPassword)
    assert.ok(await validateSession(stale.token))
    passwordForm.set('currentPassword', 'Current-password-123')
    assert.equal((await runRequest(store, () => changePasswordAction(passwordForm))).success, true)
    const rotatedToken = store.userspaceMutableCookies.get('bower_session')?.value
    assert.ok(rotatedToken)
    assert.notEqual(rotatedToken, session.token)
    assert.equal(await validateSession(stale.token), null)
    assert.equal(await validateSession(session.token), null)
    assert.ok(await validateSession(rotatedToken))
    assert.equal((await db.select().from(auditLog).where(eq(auditLog.action, 'account.password.changed'))).filter((row) => row.userId === user.id).length, 1)
  } finally {
    await db.delete(organizations).where(eq(organizations.id, org.id))
    await db.delete(users).where(eq(users.id, user.id))
  }
})

test('login and registration share throttling and public signup still creates an authenticated session', { skip: !enabled }, async () => {
  const { db } = await import('../db')
  const { users, authAbuseBuckets } = await import('../db/schema')
  const { loginAction, registerAction } = await import('./auth-actions')
  const { validateSession } = await import('./auth')
  const email = `${randomUUID()}@security.invalid`
  const form = new FormData()
  form.set('email', email)
  form.set('password', 'Signup-password-123')
  form.set('name', 'Public signup')
  await db.delete(authAbuseBuckets)
  try {
    const store = requestStore()
    await assert.rejects(runRequest(store, () => registerAction(form)), /NEXT_REDIRECT/)
    const token = store.userspaceMutableCookies.get('bower_session')?.value
    assert.ok(token)
    assert.equal((await validateSession(token))?.user.email, email)
    form.set('password', 'incorrect-password')
    assert.deepEqual(await runRequest(requestStore(), () => loginAction(form)), { error: 'Invalid email or password.' })
    form.set('email', `${randomUUID()}@security.invalid`)
    assert.deepEqual(await runRequest(requestStore(), () => loginAction(form)), { error: 'Invalid email or password.' })
    await db.delete(authAbuseBuckets)
    form.set('password', 'short')
    for (let index = 0; index < 10; index++) assert.equal((await runRequest(requestStore(), () => registerAction(form))).error, 'Password must be at least 8 characters.')
    assert.match((await runRequest(requestStore(), () => registerAction(form))).error!, /Too many authentication attempts/)
    await db.delete(authAbuseBuckets)
    const { consumeAuthAttempt } = await import('./auth-abuse')
    for (let index = 0; index < 30; index++) await consumeAuthAttempt(new Headers(), `route-password:${index}`)
    assert.match((await runRequest(requestStore(), () => loginAction(form))).error!, /Too many authentication attempts/)
  } finally {
    await db.delete(users).where(eq(users.email, email))
    await db.delete(authAbuseBuckets)
  }
})

after(async () => {
  const { db } = await import('../db')
  await db.$client.end()
})
