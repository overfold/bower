import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { createElement, type ReactElement } from 'react'
import { renderToReadableStream, renderToStaticMarkup } from 'react-dom/server'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { TrellisApiError } from './trellis'
import { DashboardStatsBar } from '@/components/dashboard-stats-bar'

// Exercise the actual route/action/page modules with controlled I/O, without a
// live DB or Next request context. Only module dependencies are replaced.
function load<T>(path: string, dependencies: Record<string, unknown>): T {
  const filename = resolve(path)
  const require = createRequire(filename)
  const loaded = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  })
  runInNewContext(outputText, {
    module: loaded, exports: loaded.exports, Response, Request, URL, Date, Promise, process,
    require: (name: string) => name in dependencies ? dependencies[name] : require(name.startsWith('@/') ? resolve('src', name.slice(2)) : name),
  }, { filename })
  return loaded.exports as T
}

function query(rows: unknown[], onWhere?: (sql: SQL) => void) {
  const promise = Promise.resolve(rows)
  return Object.assign(promise, {
    from() { return this }, innerJoin() { return this }, leftJoin() { return this },
    where(sql: SQL) { onWhere?.(sql); return this }, limit() { return this }, orderBy() { return this },
  })
}

const context = { org: { id: 'org', trellisApiUrl: 'https://api', trellisApiToken: 'fixture' }, role: 'owner' }
const access = { ...context, user: { id: 'user' }, project: { id: 'project', slug: 'demo' }, service: { slug: 'web' }, projectRole: 'admin' }
const navigation = { redirect: () => { throw new Error('redirect') }, notFound: () => { throw new Error('not found') }, useRouter: () => ({ refresh() {} }) }

test('advanced settings reject removed namespace grants and malformed cluster values before writing', async () => {
  let writes = 0
  const actions = load<typeof import('./actions/service-settings')>('src/lib/actions/service-settings.ts', {
    'next/cache': { revalidatePath() {} },
    '@/db': { db: { select: () => query([{}]), update: () => { writes++; throw new Error('Unexpected write') } } },
    '@/lib/queries': { getBaseServiceConfig: async () => ({}) },
    '@/lib/actions/shared': { requireService: async () => access, recordAudit: async () => {} },
  })
  for (const value of ['namespace:read', 'namespace:write', 'cluster:read:extra', 'cluster:admin']) {
    const form = new FormData()
    form.set('apiAccess', value)
    await assert.rejects(actions.updateServiceAdvancedAction('service', 'env', form), /Invalid workload API access/)
  }
  assert.equal(writes, 0)
})

test('SSE rejects unauthenticated, missing namespace, and inaccessible environments without opening a stream', async () => {
  let streams = 0
  let projects: Array<{ id: string }> = []
  let environmentRows: unknown[] = []
  let user: unknown = { id: 'user' }
  const filters: unknown[][] = []
  const route = load<typeof import('../app/api/trellis/events/route')>('src/app/api/trellis/events/route.ts', {
    '@/lib/auth': { getCurrentUser: async () => user },
    '@/lib/queries': { getUserOrganization: async () => context, getProjectsForUser: async () => projects },
    '@/db': { db: { select: () => query(environmentRows, (sql) => filters.push(new PgDialect().sqlToQuery(sql).params)) } },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ streamEvents: async (namespace: string, signal: AbortSignal) => {
      streams++; assert.equal(namespace, 'demo-production'); assert.ok(signal)
      return new Response('data: fixture\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
    } }) },
  })
  const request = (ns = '') => new Request(`https://bower/api/trellis/events${ns ? `?namespace=${ns}` : ''}`)
  user = null
  assert.equal((await route.GET(request('demo-production'))).status, 401)
  user = { id: 'user' }
  assert.equal((await route.GET(request())).status, 400)
  assert.equal((await route.GET(request('demo-production'))).status, 403)
  projects = [{ id: 'accessible-project' }]
  assert.equal((await route.GET(request('other-production'))).status, 403)
  assert.equal(streams, 0)
  assert.deepEqual(filters[0], ['other-production', 'accessible-project'])
  environmentRows = [{ id: 'environment' }]
  const response = await route.GET(request('demo-production'))
  assert.equal(response.status, 200)
  assert.match(await response.text(), /fixture/)
  assert.deepEqual(filters[1], ['demo-production', 'accessible-project'])
  assert.equal(streams, 1)
})

test('allocation actions deny foreign namespaces/jobs and viewer stops, and use the owned namespace for metrics/stop', async () => {
  let allocation = { id: 'a', namespace: 'staging', job: 'web-blue', phase: 'running', health: 'healthy', labels: { 'bower/service': 'web' } }
  let role = 'admin'
  const configs = [{ namespace: 'production', activeJobName: 'web-blue' }]
  const operations: unknown[][] = []
  const actions = load<typeof import('./actions/allocation-actions')>('src/lib/actions/allocation-actions.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/actions/shared': { requireService: async () => ({ ...access, projectRole: role }), recordAudit: async () => {} },
    '@/db': { db: { select: () => query(configs) } },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({
      listAllocations: async (filters: { namespace: string }) => {
        if (filters.namespace === 'staging') throw new Error('Other environment unavailable')
        assert.equal(filters.namespace, 'production'); return [allocation]
      },
      stopAllocation: async (...args: unknown[]) => { operations.push(args) },
      getAllocationMetrics: async (...args: unknown[]) => { operations.push(args); return [] },
    }) },
  })
  await assert.rejects(actions.getAllocationMetricsAction('service', 'a'), /not found/)
  allocation = { ...allocation, namespace: 'production', job: 'other', labels: { 'bower/service': 'other' } }
  await assert.rejects(actions.stopAllocationDetailAction('service', 'a'), /not found/)
  allocation = { ...allocation, job: 'web-blue' }
  role = 'viewer'
  await assert.rejects(actions.stopAllocationDetailAction('service', 'a'), /permissions/)
  assert.equal(operations.length, 0)
  configs.push({ namespace: 'staging', activeJobName: 'web-blue' })
  await actions.getAllocationMetricsAction('service', 'a')
  role = 'admin'
  await actions.stopAllocationDetailAction('service', 'a')
  assert.deepEqual(operations, [['a', 'production'], ['a', 'production']])
})

test('replacement backoff reset requires an organization operator and an owned namespace', async () => {
  let role = 'member'
  let owned: unknown[] = [{ id: 'environment' }]
  const resets: unknown[][] = []
  const audits: unknown[] = []
  const actions = load<typeof import('./actions/operations')>('src/lib/actions/operations.ts', {
    'next/cache': { revalidatePath() {} },
    '@/db': { db: { select: () => query(owned) } },
    '@/lib/auth': {},
    './shared': {
      requireContext: async () => ({ ...context, role, user: { id: 'user' } }),
      recordAudit: async (entry: unknown) => { audits.push(entry) },
    },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ resetReplacementBackoff: async (...args: unknown[]) => { resets.push(args) } }) },
    '@/lib/managed-proxy': {},
  })
  await assert.rejects(actions.resetReplacementBackoffAction('production', 'web', 'api'), /owners and admins/)
  role = 'admin'
  owned = []
  await assert.rejects(actions.resetReplacementBackoffAction('foreign', 'web', 'api'), /Namespace not found/)
  owned = [{ id: 'environment' }]
  await actions.resetReplacementBackoffAction('production', 'web', 'api')
  assert.deepEqual(resets, [['web', 'api', 'production']])
  assert.equal(audits.length, 1)
})

test('service deletion retains records on job or ingress cleanup failure; absent jobs permit deletion', async () => {
  let deleted = 0
  let failure: Error | null = new TrellisApiError(403, 'Forbidden', 'denied')
  let proxyFailure = false
  const actions = load<typeof import('./actions/services')>('src/lib/actions/services.ts', {
    'next/navigation': navigation, 'next/cache': { revalidatePath() {} }, '@/lib/auth': {}, '@/lib/queries': {},
    '@/lib/deployment-runtime': {}, '@/lib/deployment-reconciler': {},
    '@/lib/actions/shared': { requireService: async () => access, recordAudit: async () => {} },
    '@/db': { db: { select: () => query([{ config: { activeJobName: 'web-blue' }, environment: { id: 'env', trellisNamespace: 'production' } }]), delete: () => { deleted++; return query([]) } } },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ deleteJob: async () => { if (failure) throw failure } }) },
    '@/lib/managed-proxy': { syncManagedProxy: async (...args: unknown[]) => { assert.equal(args[3], 'service'); if (proxyFailure) throw new Error('proxy offline') } },
  })
  assert.match((await actions.deleteServiceAction('service', 'demo')).error!, /not deleted/)
  failure = new TrellisApiError(404, 'Not Found', 'absent')
  proxyFailure = true
  assert.match((await actions.deleteServiceAction('service', 'demo')).error!, /not deleted/)
  assert.equal(deleted, 0)
  proxyFailure = false
  await assert.rejects(actions.deleteServiceAction('service', 'demo'), /redirect/)
  assert.equal(deleted, 1)
})

test('project deletion retains records on required cleanup failure', async () => {
  let deleted = false
  const rows = [[{ id: 'project' }], [{ id: 'env', trellisNamespace: 'production' }], [], []]
  const actions = load<typeof import('./actions/projects')>('src/lib/actions/projects.ts', {
    'next/navigation': navigation,
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'user' }) }, '@/lib/queries': { getUserOrganization: async () => context },
    './shared': { recordAudit: async () => {} },
    '@/lib/managed-proxy': { syncManagedProxy: async () => { throw new Error('offline') } },
    '@/db': { db: { select: () => query(rows.shift()!), delete: () => { deleted = true; return query([]) } } },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ deleteJob: async () => { throw new Error('offline') }, deleteSecret: async () => {} }) },
  })
  assert.match((await actions.deleteProjectAction('project')).error!, /not deleted/)
  assert.equal(deleted, false)
})

test('project deletion excludes its routes without deleting shared ingress', async () => {
  let deleted = false
  const removedJobs: string[] = []
  const excluded: unknown[][] = []
  const rows = [[{ id: 'project' }], [{ id: 'env', trellisNamespace: 'production' }], [{ slug: 'web', environmentId: 'env' }], []]
  const actions = load<typeof import('./actions/projects')>('src/lib/actions/projects.ts', {
    'next/navigation': navigation,
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'user' }) }, '@/lib/queries': { getUserOrganization: async () => context },
    './shared': { recordAudit: async () => {} },
    '@/lib/managed-proxy': { syncManagedProxy: async (...args: unknown[]) => { excluded.push(args) } },
    '@/db': { db: { select: () => query(rows.shift()!), delete: () => { deleted = true; return query([]) } } },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ deleteJob: async (name: string) => { removedJobs.push(name) } }) },
  })
  await assert.rejects(actions.deleteProjectAction('project'), /redirect/)
  assert.deepEqual(excluded, [['project', '', 'org', undefined, 'project']])
  assert.ok(removedJobs.includes('web'))
  assert.ok(!removedJobs.includes('bower-ingress'))
  assert.ok(!removedJobs.includes('bower-proxy'))
  assert.equal(deleted, true)
})

test('reconciler targets the persisted accepted job identity rather than inferring an allocation revision', async () => {
  const updates: Array<{ status: string }> = []
  let selects = 0
  const reconciler = load<typeof import('./deployment-reconciler')>('src/lib/deployment-reconciler.ts', {
    '@/db': { db: {
      select: () => query(selects++ === 0 ? [{ id: 'env', trellisNamespace: 'production' }] : [{ autoRollbackSeconds: 300, deploymentStrategy: 'rolling' }]),
      update: () => ({ set: (value: { status: string }) => { updates.push(value); return query([]) } }),
    } },
    '@/lib/queries': { getDeploymentsByProject: async () => [{ serviceSlug: 'web', deployment: {
      id: 'deployment', serviceId: 'service', environmentId: 'env', status: 'deploying', strategy: 'rolling', startedAt: new Date(),
      trellisJobName: 'web', trellisIncarnation: 'inc-a', trellisVersion: 4, trellisRevision: 2,
      jobSpec: { name: 'web', namespace: 'production', task_groups: [{ name: 'web', count: 1, tasks: [] }] },
    } }] },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ getJob: async () => ({
      name: 'web', incarnation: 'inc-a', version: 4, revision: 2, desired: 1, running: 1, healthy: 1,
      allocations: [{ id: 'current', group: 'web', job_revision: 2, phase: 'running', health: 'healthy', draining: false }],
    }) }) },
    '@/lib/managed-proxy': {},
    '@/lib/deployment-runtime': { recordDeploymentEvent: async () => {}, createDeploymentSpec: async () => ({}), notifyDeployment: async () => {} },
  })
  await reconciler.reconcileProjectDeployments('project', 'org')
  assert.equal(updates.length, 1)
  assert.equal(updates[0].status, 'healthy')
})

test('shared ingress aggregates environments, skips unchanged applies, and survives the last route deletion', async () => {
  const statuses: string[] = []
  let definitions = ['a', 'b'].map((id) => ({
    route: { id, projectId: `project-${id}`, environmentId: `env-${id}`, domain: `${id}.example.com`, protectionMode: 'none', headers: {}, responseHeaders: {}, redirects: [], tlsMode: 'none' },
    service: { slug: 'web' }, config: {}, environment: { trellisNamespace: `team-${id}` },
  }))
  let applied: import('@/types/trellis').TrellisJobSpec | undefined
  let applies = 0
  let secretWrites = 0
  let deleted = false
  let selectIndex = 0
  const sync = load<typeof import('./managed-proxy')>('src/lib/managed-proxy.ts', {
    '@/db': { db: {
      select: () => query(selectIndex++ % 2 === 0 ? definitions : [{ id: 'env-a' }, { id: 'env-b' }]),
      insert: () => ({ values: (values: { status: string }) => { statuses.push(values.status); return { onConflictDoUpdate: async () => {} } } }),
      delete: () => { deleted = true; return query([]) },
    } },
    '@/lib/ingress-cluster': { getIngressCluster: async () => ({ orgIds: ['org', 'org-b'], home: true }), ingressNamespace: () => 'platform' },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({
      getJob: async () => { if (!applied) throw new TrellisApiError(404, 'Not Found', 'absent'); return { spec: applied } },
      setSecret: async () => { secretWrites++ }, planJob: async () => ({ action: 'create' }),
      applyJobPlan: async (spec: import('@/types/trellis').TrellisJobSpec) => { applied = spec; applies++ },
      deleteJob: async () => { throw new Error('must not delete ingress') }, deleteSecret: async () => { throw new Error('must not delete bootstrap secret') },
    }) },
  })
  await sync.syncManagedProxy('project', 'env', 'org')
  assert.deepEqual(statuses, ['pending', 'pending'])
  assert.equal(applied!.name, 'bower-ingress')
  assert.equal(applied!.namespace, 'platform')
  const group = applied!.task_groups[0]
  assert.deepEqual(JSON.parse(JSON.stringify(group.api_access)), { scope: 'cluster', access: 'read' })
  assert.equal(group.update?.strategy, 'recreate')
  assert.deepEqual(JSON.parse(group.tasks[1].env!.BOWER_ROUTES).map((route: { namespace: string }) => route.namespace), ['team-a', 'team-b'])
  assert.equal(JSON.parse(group.tasks[1].env!.BOWER_DASHBOARD).job, 'bower')
  assert.match(group.tasks[0].env!.BOWER_CADDYFILE, /Bower dashboard is starting/)
  assert.equal(group.tasks[0].secrets!.length, 0)
  const expectedVolumes = [
    { name: 'bower-ingress-data', host_path: '@/bower-ingress-data', container_path: '/data' },
    { name: 'bower-ingress-config', host_path: '@/bower-ingress-config', container_path: '/config' },
  ]
  assert.deepEqual(JSON.parse(JSON.stringify(group.tasks[0].volumes)), expectedVolumes)
  assert.equal(group.tasks[1].volumes, undefined)
  await sync.syncManagedProxy('project', 'env', 'org')
  assert.equal(applies, 1)
  assert.equal(secretWrites, 0)
  // An existing pre-volume job must upgrade even when its routes and images
  // are unchanged, then settle back into no-op reconciliation.
  const env = group.tasks[1].env!
  const legacyHash = createHash('sha256').update(JSON.stringify({
    controllerRoutes: JSON.parse(env.BOWER_ROUTES),
    options: { adminPort: env.CADDY_ADMIN_PORT, httpPort: env.CADDY_HTTP_PORT, httpsPort: env.CADDY_HTTPS_PORT,
      dashboard: JSON.parse(env.BOWER_DASHBOARD) },
    tls: [],
  })).digest('hex')
  delete group.tasks[0].volumes
  group.labels!['bower/config-hash'] = legacyHash
  await sync.syncManagedProxy('project', 'env', 'org')
  assert.equal(applies, 2)
  assert.notEqual(applied!.task_groups[0].labels!['bower/config-hash'], legacyHash)
  assert.deepEqual(JSON.parse(JSON.stringify(applied!.task_groups[0].tasks[0].volumes)), expectedVolumes)
  await sync.syncManagedProxy('project', 'env', 'org')
  assert.equal(applies, 2)
  definitions = []
  await sync.syncManagedProxy('project', 'env', 'org')
  assert.equal(applies, 3)
  assert.equal(deleted, true)
  assert.deepEqual(JSON.parse(applied!.task_groups[0].tasks[1].env!.BOWER_ROUTES), [])
  assert.equal(JSON.parse(applied!.task_groups[0].tasks[1].env!.BOWER_DASHBOARD).job, 'bower')
  assert.deepEqual(JSON.parse(JSON.stringify(applied!.task_groups[0].tasks[0].volumes)), expectedVolumes)
})

test('shared ingress uses namespace-qualified TLS mounts and reapplies on certificate rotation', async () => {
  let version = 1
  let applied: import('@/types/trellis').TrellisJobSpec | undefined
  let applies = 0
  const definitions = ['a', 'b'].map((id) => ({
    route: { id, projectId: id, environmentId: id, domain: `${id}.example.com`, protectionMode: 'none', tlsMode: 'custom', tlsCertSecret: 'CERT', tlsKeySecret: 'KEY' },
    service: { slug: 'web' }, config: {}, environment: { trellisNamespace: `team-${id}` },
  }))
  let selectIndex = 0
  const helper = load<typeof import('./ingress-cluster')>('src/lib/ingress-cluster.ts', {})
  const sync = load<typeof import('./managed-proxy')>('src/lib/managed-proxy.ts', {
    '@/db': { db: { select: () => query(selectIndex++ % 2 === 0 ? definitions : []) } },
    '@/lib/ingress-cluster': { ...helper, getIngressCluster: async () => ({ orgIds: ['org'], home: false }) },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({
      getJob: async () => { if (!applied) throw new TrellisApiError(404, 'Not Found', 'absent'); return { spec: applied } },
      getSecret: async () => ({ version }), setSecret: async () => {}, planJob: async () => ({}),
      applyJobPlan: async (spec: import('@/types/trellis').TrellisJobSpec) => { applies++; applied = spec },
    }) },
  })
  await sync.syncManagedProxy('a', 'a', 'org')
  const mounts = applied!.task_groups[0].tasks[0].secrets!
  assert.equal(mounts.length, 4)
  assert.equal(new Set(mounts.map((mount) => mount.name)).size, 4)
  const rendered = JSON.parse(applied!.task_groups[0].tasks[1].env!.BOWER_ROUTES)
  assert.notEqual(rendered[0].tlsCertSecret, rendered[1].tlsCertSecret)
  const hash = applied!.task_groups[0].labels!['bower/config-hash']
  await sync.syncManagedProxy('a', 'a', 'org')
  assert.equal(applies, 1)
  version = 2
  await sync.syncManagedProxy('a', 'a', 'org')
  assert.equal(applies, 2)
  assert.notEqual(applied!.task_groups[0].labels!['bower/config-hash'], hash)
})

test('cluster ingress groups organizations by endpoint and rejects cross-organization hostname claims', async (t) => {
  const previous = process.env.TRELLIS_API_URL
  const previousPublic = process.env.BOWER_PUBLIC_URL
  process.env.TRELLIS_API_URL = 'https://cluster.test'
  process.env.BOWER_PUBLIC_URL = 'https://bower.example.com'
  t.after(() => {
    if (previous === undefined) delete process.env.TRELLIS_API_URL; else process.env.TRELLIS_API_URL = previous
    if (previousPublic === undefined) delete process.env.BOWER_PUBLIC_URL; else process.env.BOWER_PUBLIC_URL = previousPublic
  })
  const orgs = [
    { id: 'a', trellisApiUrl: 'cluster.test/', trellisApiToken: 'a' },
    { id: 'b', trellisApiUrl: 'https://cluster.test', trellisApiToken: 'b' },
    { id: 'c', trellisApiUrl: 'https://other.test', trellisApiToken: 'c' },
  ]
  const helper = load<typeof import('./ingress-cluster')>('src/lib/ingress-cluster.ts', {
    '@/db': { db: { select: (shape: unknown) => query(shape ? [{ route: { id: 'route-b', domain: '*.apps.example.com', projectId: 'b', environmentId: 'env-b' } }] : orgs) } },
  })
  assert.deepEqual(JSON.parse(JSON.stringify((await helper.getIngressCluster('a')).orgIds)), ['a', 'b'])
  assert.equal((await helper.getIngressCluster('a')).home, true)
  assert.equal((await helper.getIngressCluster('c')).home, false)
  await assert.rejects(helper.assertIngressHostname('a', 'a', 'env-a', 'shop.apps.example.com'), /another environment/)
  await assert.rejects(helper.assertIngressHostname('a', 'a', 'env-a', 'bower.example.com'), /reserved/)
  await helper.assertIngressHostname('a', 'b', 'env-b', 'shop.apps.example.com')
  await helper.assertIngressHostname('a', 'a', 'env-a', 'unique.example.com')
  assert.notEqual(helper.ingressSecretName('team-a', 'CERT'), helper.ingressSecretName('team-b', 'CERT'))
})

test('TLS PEM uploads mirror into ingress without copying ordinary secrets', async () => {
  const writes: Array<[string, string, string]> = []
  const removals: Array<[string, string]> = []
  const actions = load<typeof import('./actions/operations')>('src/lib/actions/operations.ts', {
    'next/cache': { revalidatePath() {} }, '@/lib/auth': {}, '@/lib/managed-proxy': {},
    './shared': { requireProject: async () => access, recordAudit: async () => {}, text: (form: FormData, key: string) => String(form.get(key) ?? '') },
    '@/db': { db: {
      select: () => query([{ trellisNamespace: 'team-a' }]),
      insert: () => ({ values: () => ({ onConflictDoUpdate: async () => {} }) }),
    } },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({
      setSecret: async (...args: [string, string, string]) => { writes.push(args) },
      deleteSecret: async (...args: [string, string]) => { removals.push(args) },
    }) },
  })
  const form = new FormData()
  form.set('environmentId', 'env'); form.set('name', 'CERT'); form.set('value', '-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----')
  await actions.setSecretAction('project', form)
  assert.equal(writes.length, 2)
  assert.equal(writes[0][0], 'team-a')
  assert.equal(writes[1][0], 'platform')
  assert.match(writes[1][1], /^BOWER_TLS_[a-f0-9]{64}$/)
  assert.equal(writes[1][2], writes[0][2])
  writes.length = 0
  form.set('name', 'TOKEN'); form.set('value', 'ordinary-secret-fixture')
  await actions.setSecretAction('project', form)
  assert.equal(writes.length, 1)
  assert.equal(removals.length, 1)
  assert.equal(removals[0][0], 'platform')
})

const servicePath = 'src/app/(dashboard)/projects/[slug]/services/[serviceSlug]'
type Page = { default: (props: { params: Promise<{ slug: string; serviceSlug: string; allocationId: string }> }) => Promise<ReactElement> }
const props = { params: Promise.resolve({ slug: 'demo', serviceSlug: 'web', allocationId: 'a' }) }
const readError = load('src/components/trellis-read-error.tsx', { 'next/navigation': navigation })
const environment = { id: 'env', trellisNamespace: 'production' }
function pageDependencies(client: unknown) {
  return {
    'next/navigation': navigation,
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'user' }) },
    '@/lib/queries': {
      getUserOrganization: async () => context, getProjectBySlug: async () => ({ id: 'project' }),
      getServiceBySlug: async () => ({ id: 'service', slug: 'web', name: 'Web' }), getProjectEnvironment: async () => environment,
      getServiceConfigsWithEnvironments: async () => [{ config: { id: 'config', activeJobName: 'web' }, environment }], getDeploymentsByService: async () => [],
    },
    '@/lib/actions/shared': { getProjectRole: async () => 'admin' },
    '@/lib/trellis-instance': { getTrellisClient: async () => client }, '@/components/trellis-read-error': readError,
    './service-header': { ServiceHeader: () => null }, './service-actions': { ServiceActions: () => null },
    './allocations/[allocationId]/allocation-metrics': { AllocationMetrics: () => null },
    '@/components/deployment-poller': { DeploymentPoller: () => null }, '@/components/exec-dialog': { ExecDialog: () => null },
    './allocation-stop-button': { AllocationStopButton: () => null },
  }
}

test('service errors are not empty allocations and pending placement diagnostics remain visible', async () => {
  let result: unknown[] | null = null
  const page = load<Page>(`${servicePath}/page.tsx`, pageDependencies({ listAllocations: async () => { if (!result) throw new Error('offline'); return result } }))
  let html = renderToStaticMarkup(await page.default(props))
  assert.match(html, /Allocations unavailable/)
  assert.doesNotMatch(html, /No current allocations/)
  result = []
  assert.match(renderToStaticMarkup(await page.default(props)), /No current allocations/)
  result = [{ id: 'pending', namespace: 'production', job: 'web', phase: 'pending', health: 'unknown', message: 'No eligible nodes', created_at: '2026-09-30T00:00:00Z' }, { id: 'foreign', namespace: 'staging', job: 'web', phase: 'running', health: 'healthy' }]
  html = renderToStaticMarkup(await page.default(props))
  assert.match(html, /No eligible nodes/)
  assert.doesNotMatch(html, /foreign/)
})

test('allocation panels preserve successful logs and distinguish empty events/metrics from unavailable data without invented placement', async () => {
  let eventsFail = true
  let metricsFail = true
  const metrics = load(`${servicePath}/allocations/[allocationId]/allocation-metrics.tsx`, { '@/lib/actions/allocation-actions': {} })
  const logs = load(`${servicePath}/allocations/[allocationId]/allocation-logs.tsx`, {
    '@/lib/actions/allocation-actions': {},
    '@/components/ui/feedback': { useFeedback: () => ({ toast() {} }), InlineNotice: ({ children }: { children: ReactElement }) => children },
  })
  const page = load<Page>(`${servicePath}/allocations/[allocationId]/page.tsx`, {
    ...pageDependencies({
      listAllocations: async () => [{ id: 'a', namespace: 'production', job: 'web', group: 'main', job_revision: 1, phase: 'pending', health: 'unknown', created_at: '2026-09-30T00:00:00Z', last_transition_at: '2026-09-30T00:00:00Z' }],
      getAllocationEvents: async () => { if (eventsFail) throw new Error('offline'); return [] },
      getAllocationMetrics: async () => { if (metricsFail) throw new Error('offline'); return [] },
      getJob: async () => ({ revision: 1, spec: { task_groups: [{ name: 'main', tasks: [{ name: 'app' }] }] } }),
      getJobVersions: async () => [{ version: 1, revision: 1, spec: { task_groups: [{ name: 'main', tasks: [{ name: 'app' }] }] } }],
      getAllocationLogs: async () => 'independent log output',
    }), './allocation-metrics': metrics, './allocation-logs': logs,
  })
  let html = renderToStaticMarkup(await page.default(props))
  assert.match(html, /Lifecycle events unavailable/)
  assert.match(html, /Unavailable/)
  assert.match(html, /independent log output/)
  assert.doesNotMatch(html, /created and placed|No lifecycle events have been recorded/)
  eventsFail = metricsFail = false
  html = renderToStaticMarkup(await page.default(props))
  assert.match(html, /No lifecycle events have been recorded/)
  assert.match(html, /No samples/)
  assert.doesNotMatch(html, /created and placed|Lifecycle events unavailable/)
})

test('version history keeps the deployment journal and omits the separate retained-version table', async () => {
  const page = load<Page>(`${servicePath}/revisions/page.tsx`, {
    'next/navigation': navigation,
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'user' }) },
    '@/lib/queries': {
      getUserOrganization: async () => context,
      getProjectBySlug: async () => ({ id: 'project' }),
      getProjectEnvironment: async () => environment,
      getServiceBySlug: async () => ({ id: 'service', slug: 'web', name: 'Web' }),
      getServiceConfigsWithEnvironments: async () => [{ config: { activeJobName: 'web' }, environment }],
      getDeploymentsByService: async () => [{ id: 'deployment', environmentId: 'env', trellisVersion: 12, trellisRevision: 7, trellisJobName: 'web', status: 'healthy', imageAfter: 'app:v2', triggerType: 'manual', createdAt: '2026-10-01T10:00:00Z' }],
    },
    '@/lib/actions/shared': { getProjectRole: async () => 'admin' },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ getJobVersions: async () => [
      { version: 5, revision: 3, spec: { name: 'web' }, created_at: '2026-09-30T10:00:00Z' },
      { version: 6, revision: 3, spec: { name: 'web' }, created_at: '2026-09-30T11:00:00Z' },
    ] }) },
    '@/lib/trellis-runtime': { trellisReadError: () => 'unavailable' },
    '@/components/trellis-read-error': readError,
    './restore-revision-button': { RestoreRevisionButton: () => null },
    '../service-header': { ServiceHeader: () => null },
  })
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: 'demo', serviceSlug: 'web', allocationId: '' }) }))
  assert.match(html, /Only the most recent configurations can be restored/)
  assert.doesNotMatch(html, /Retained Trellis versions/)
  assert.match(html, />7<\/span><\/td>/)
  assert.match(html, /Succeeded/)
  assert.doesNotMatch(html, />5<\/td><td[^>]*>3</)
  assert.doesNotMatch(html, />6<\/td><td[^>]*>3</)
})

test('pending allocations count against runtime health rather than declaring all healthy', () => {
  const html = renderToStaticMarkup(createElement(DashboardStatsBar, {
    allocations: [{ phase: 'running', health: 'healthy' }, { phase: 'pending', health: 'unknown' }] as never[], deployments: [], clusterAvailable: true, capacityAvailable: false,
    capacity: { cpuTotal: 1000, cpuAllocated: 500, memoryTotal: 1000, memoryAllocated: 500 },
  }))
  assert.match(html, /1\/2/)
  assert.match(html, /1 blocked \/ awaiting placement/)
  assert.match(html, /Capacity data unavailable/)
  assert.doesNotMatch(html, /All active allocations healthy|50%/)
})

test('metrics failure keeps node and independently observed ingress status visible', async () => {
  const page = load<{ default: () => Promise<ReactElement> }>('src/app/(dashboard)/status/page.tsx', {
    ...pageDependencies({ listNodes: async () => [{ id: 'node-a', status: 'healthy', cpu: 1000, memory: 1024, host: 'node', port: 8128 }], getMetrics: async () => { throw new Error('offline') }, getClusterSettings: async () => { throw new Error('offline') }, listJobs: async () => [], listAllocations: async () => [{ namespace: 'production', job: 'bower-proxy', phase: 'running', health: 'unhealthy', message: 'Route-sync freshness check failed.' }] }),
    '@/lib/queries': { getUserOrganization: async () => context, getManagedProxiesForOrg: async () => [{ namespace: 'production', proxy: { id: 'proxy', environmentId: 'env', trellisJobName: 'bower-proxy', status: 'running', configHash: null, updatedAt: new Date() } }], getRouteCountsByEnvironment: async () => [], getOperationalTargetsForOrg: async () => [] },
    './drain-toggle': { DrainToggle: () => null },
    './reset-backoff-button': { ResetBackoffButton: () => null },
  })
  const html = renderToStaticMarkup(await page.default())
  assert.match(html, /node-a/)
  assert.match(html, /Capacity data unavailable/)
  assert.match(html, /Failed/)
  assert.match(html, /Route-sync freshness check failed/)
  assert.doesNotMatch(html, /Unable to reach cluster/)
})

test('project summary counts and latest timestamp are independent of deployment result and row order', async () => {
  const older = new Date('2026-09-20T12:00:00Z')
  const newer = new Date('2026-10-01T12:00:00Z')
  const latest = [
    { projectId: 'p', serviceId: 'broken', status: 'failed', createdAt: older },
    { projectId: 'p', serviceId: 'working', status: 'healthy', createdAt: newer },
  ]
  let selects = 0
  const chain = (rows: unknown[]) => Object.assign(query(rows), {
    groupBy() { return this }, orderBy() { return this },
    limit() { throw new Error('Latest-per-service must not use a history limit') },
  })
  const queries = load<typeof import('./queries')>('src/lib/queries.ts', {
    'next/headers': {},
    '@/db': { db: {
      select: () => chain([{ projectId: 'p', count: ++selects === 1 ? 2 : 3 }]),
      selectDistinctOn: () => chain(latest),
    } },
  })
  for (const order of [latest, [...latest].reverse()]) {
    latest.splice(0, latest.length, ...order)
    selects = 0
    const [summary, empty] = await queries.getProjectSummaries(['p', 'empty'])
    assert.equal('healthStatus' in summary, false, 'Deployment results must not stand in for live health')
    assert.equal(summary.latestDeployment?.status, 'healthy')
    assert.equal(summary.latestDeployment?.createdAt.toISOString(), newer.toISOString())
    assert.equal(summary.serviceCount, 2)
    assert.equal(summary.routeCount, 3)
    assert.equal(empty.latestDeployment, null)
    assert.equal('healthStatus' in empty, false)
  }
})

test('live service summaries use inherited replicas and image while retaining the active job name', async () => {
  const stored = { serviceId: 'web', environmentId: 'env', replicas: 1, image: 'stale:v1', activeJobName: 'web-blue', overrides: { image: 'override:v3' } }
  const results = [[{ id: 'web', slug: 'web' }], [stored], [], [{ serviceId: 'web', replicas: 3, image: 'base:v2' }], [stored]]
  const chain = (rows: unknown[]) => Object.assign(query(rows), { orderBy() { return this }, groupBy() { return this } })
  const queries = load<typeof import('./queries')>('src/lib/queries.ts', {
    'next/headers': {},
    '@/db': { db: { select: () => chain(results.shift()!), selectDistinctOn: () => chain([]) } },
  })
  const [summary] = await queries.getServiceSummaries('project', 'env')
  assert.equal(summary.config?.replicas, 3)
  assert.equal(summary.config?.image, 'override:v3')
  assert.equal(summary.config?.activeJobName, 'web-blue')
})

test('service header shows the serving release, not an undeployed edit or a failed candidate', async () => {
  const deployment = { status: 'healthy', imageBefore: 'app:v1', imageAfter: 'app:v2' }
  const captured: string[] = []
  const logLinks: string[] = []
  const layout = load<{ default: (props: { children: ReactElement; params: Promise<{ slug: string; serviceSlug: string }> }) => Promise<ReactElement> }>(`${servicePath}/layout.tsx`, {
    'next/navigation': navigation,
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'user' }) },
    '@/lib/actions/shared': { getProjectRole: async () => 'admin' },
    '@/lib/queries': {
      getUserOrganization: async () => context,
      getProjectBySlug: async () => ({ id: 'project' }),
      getServiceBySlug: async () => ({ id: 'service', projectId: 'project', slug: 'web' }),
      getProjectEnvironment: async () => environment,
      getRoutesByProject: async () => [],
      getDeploymentsByService: async () => [{ ...deployment, environmentId: 'env', jobSpec: { task_groups: [] }, id: 'deployment', createdAt: new Date(), imageAfter: 'app:v2' }],
      getMergedServiceConfig: async () => ({ image: 'app:undeployed' }),
    },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ getJob: async () => ({ replacement_backoff: [] }) }) },
    '@/lib/service-config-diff': { diffServiceConfig: () => [] },
    '@/lib/service-health-query': { getProjectLiveServices: async () => ({ services: [{ service: { id: 'service' }, allocations: [{ id: 'ready', phase: 'running', health: 'healthy' }, { id: 'failing', phase: 'failed', health: 'unhealthy' }], config: { image: 'app:undeployed', replicas: 1 }, latestDeployment: deployment, ready: 1, health: 'healthy' }] }) },
    './service-header': { ServiceHeader: ({ image, logsHref }: { image: string; logsHref: string }) => { captured.push(image); logLinks.push(logsHref); return null } },
    './service-shell': { ServiceShell: ({ header, children }: { header: ReactElement; children: ReactElement }) => createElement('div', null, header, children) },
  })
  for (const status of ['healthy', 'failed']) {
    deployment.status = status
    const stream = await renderToReadableStream(await layout.default({ children: createElement('div'), params: Promise.resolve({ slug: 'demo', serviceSlug: 'web' }) }))
    await stream.allReady
    await new Response(stream).text()
  }
  assert.deepEqual(captured, ['app:v2', 'app:v1'])
  assert.deepEqual(logLinks, Array(2).fill('/projects/demo/services/web/allocations/failing'))
})

test('failed-deploy marker renders with its tooltip provider and a diagnostic link', () => {
  const { LastDeployFailed } = load<typeof import('../components/last-deploy-failed')>('src/components/last-deploy-failed.tsx', {})
  const html = renderToStaticMarkup(createElement(LastDeployFailed, { href: '/projects/demo/deployments/failed' }))
  assert.match(html, /Last deploy failed — view diagnostics/)
  assert.match(html, /href="\/projects\/demo\/deployments\/failed"/)
})

test('audit before/after-only details render changes, not an empty-state or unchanged fields', () => {
  const { AuditLogList } = load<typeof import('../app/(dashboard)/audit/audit-log-list')>('src/app/(dashboard)/audit/audit-log-list.tsx', {})
  const html = renderToStaticMarkup(createElement(AuditLogList, {
    now: Date.parse('2026-10-02T12:00:00Z'),
    entries: [{ id: 'event', action: 'service.update', resourceType: 'service', resourceId: 'web', userName: 'Alex', createdAt: '2026-10-01T12:00:00Z', details: { before: { replicas: 2, unchanged: 'same' }, after: { replicas: 5, unchanged: 'same' } } }],
  }))
  assert.match(html, /<span class="text-ink-muted">2<\/span>/)
  assert.match(html, /<span class="mx-2 text-ink-muted" aria-label="changed to">→<\/span>/)
  assert.match(html, /<span class="text-ink">5<\/span>/)
  assert.doesNotMatch(html, /No additional details|unchanged/)
})

test('targeted rollback scopes the target and replays its spec rather than the latest previous spec', async () => {
  const selected = { name: 'web-blue', namespace: 'production', task_groups: [{ name: 'main', tasks: [{ image: 'app:v2' }] }] }
  const previous = { ...selected, name: 'web-green', task_groups: [{ name: 'main', tasks: [{ image: 'app:v3' }] }] }
  let targetAvailable = true
  let role = 'admin'
  let reads = 0
  let targetSql: { sql: string; params: unknown[] } | undefined
  const applied: unknown[] = []
  const actions = load<typeof import('./actions/services')>('src/lib/actions/services.ts', {
    'next/navigation': navigation, 'next/cache': { revalidatePath() {} },
    '@/lib/auth': {}, '@/lib/queries': {},
    '@/lib/actions/shared': { requireService: async () => ({ ...access, projectRole: role }), recordAudit: async () => {} },
    '@/lib/managed-proxy': {}, '@/lib/deployment-reconciler': {},
    '@/lib/deployment-runtime': { recordDeploymentEvent: async () => {}, notifyDeployment: async () => {}, createDeploymentSpec: async () => ({}) },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ planJob: async (spec: unknown) => { applied.push(spec); return {} }, applyJobPlan: async (spec: unknown) => { applied.push(spec); return { incarnation: 'i', version: 7, revision: 9 } } }) },
    '@/db': { db: {
      select: () => {
        reads++
        return Object.assign(query(reads === 1 ? [{ jobSpec: previous, previousJobSpec: previous }] : reads === 2 ? targetAvailable ? [{ jobSpec: selected }] : [] : [{ id: 'config', image: 'app:v4', deploymentStrategy: 'rolling' }], reads === 2 ? (sql) => { targetSql = new PgDialect().sqlToQuery(sql) } : undefined), { orderBy() { return this } })
      },
      insert: () => ({ values: () => ({ returning: async () => [{ id: 'rollback' }] }) }),
      update: () => ({ set: () => ({ where: async () => {} }) }),
    } },
  })
  assert.equal((await actions.rollbackServiceAction('service', 'env', 'selected-deployment')).error, undefined)
  assert.equal(applied.length, 2)
  for (const spec of applied) assert.equal(JSON.stringify(spec), JSON.stringify(selected))
  assert.deepEqual(targetSql?.params, ['selected-deployment', 'service', 'env', 'healthy'])
  targetAvailable = false; reads = 0
  assert.match((await actions.rollbackServiceAction('service', 'env', 'foreign-deployment')).error ?? '', /no successful stored JobSpec/)
  assert.equal(applied.length, 2)
  role = 'viewer'
  assert.equal((await actions.rollbackServiceAction('service', 'env', 'selected-deployment')).error, 'Insufficient permissions.')
  assert.equal(applied.length, 2)
})

test('route editing validates the target project/environment and persists the selected service', async () => {
  let rows: unknown[][] = []
  let written: Record<string, unknown> | undefined
  const filters: unknown[][] = []
  const actions = load<typeof import('./actions/operations')>('src/lib/actions/operations.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/auth': {}, '@/lib/trellis-instance': {},
    './shared': { requireProject: async () => access, recordAudit: async () => {}, text: (form: FormData, key: string) => String(form.get(key) ?? ''), integer: (form: FormData, key: string, fallback: number) => form.has(key) ? Number(form.get(key)) : fallback },
    '@/lib/managed-proxy': { syncManagedProxy: async () => {} },
    '@/lib/ingress-cluster': { assertIngressHostname: async () => {} },
    '@/db': { db: {
      select: () => query(rows.shift()!, (sql) => filters.push(new PgDialect().sqlToQuery(sql).params)),
      update: () => ({ set: (value: Record<string, unknown>) => { written = value; return { where: async () => {} } } }),
    } },
  })
  const form = new FormData()
  for (const [key, value] of Object.entries({ serviceId: 'new-service', domain: 'shop.acme.test', port: '8123', tlsMode: 'none', protectionMode: 'none' })) form.set(key, value)
  const before = { id: 'route', environmentId: 'env', serviceId: 'old-service' }
  for (const [service, config] of [[[], [{ id: 'config' }]], [[{ id: 'new-service' }], []]]) {
    rows = [[before], service, config]
    await assert.rejects(actions.updateRouteAction('project', 'route', form), /target service must be configured/)
    assert.equal(written, undefined)
  }
  filters.length = 0
  rows = [[before], [{ id: 'new-service' }], [{ id: 'config' }]]
  await actions.updateRouteAction('project', 'route', form)
  assert.deepEqual(filters.slice(1), [['new-service', 'project'], ['new-service', 'env']])
  assert.equal(written?.serviceId, 'new-service')
  assert.equal(written?.port, 8123)
})

test('protected route mutations return configuration errors before writes and accept the 32-character boundary', async () => {
  const originalUrl = process.env.BOWER_PUBLIC_URL
  const originalSecret = process.env.BOWER_ROUTE_AUTH_SECRET
  let writes = 0
  const dependencies = {
    'next/cache': { revalidatePath() {} },
    '@/lib/auth': { hashPassword: async () => 'fixture-hash' }, '@/lib/trellis-instance': {},
    './shared': { requireProject: async () => access, recordAudit: async () => {}, text: (form: FormData, key: string) => String(form.get(key) ?? ''), integer: (form: FormData, key: string, fallback: number) => form.has(key) ? Number(form.get(key)) : fallback },
    '@/lib/managed-proxy': { syncManagedProxy: async () => {} },
    '@/lib/ingress-cluster': { assertIngressHostname: async () => {} },
    '@/db': { db: {
      select: () => query([{ id: 'route', environmentId: 'env', serviceId: 'service', slug: 'web', passwordHash: null }]),
      insert: () => ({ values: () => { writes++; return { returning: async () => [{ id: 'route' }] } } }),
      update: () => ({ set: () => { writes++; return { where: async () => {} } } }),
    } },
  }
  const operations = load<typeof import('./actions/operations')>('src/lib/actions/operations.ts', dependencies)
  const routes = load<typeof import('./actions/routes')>('src/lib/actions/routes.ts', {
    ...dependencies, './operations': operations, '@/lib/domain-queries': {},
  })
  const mutations = [
    (form: FormData) => operations.createRouteAction('project', form),
    (form: FormData) => operations.updateRouteAction('project', 'route', form),
    (form: FormData) => routes.updateRouteProtectionAction('project', 'route', form),
  ]
  try {
    for (const mutate of mutations) {
      for (const mode of ['password', 'bower_auth']) {
        const form = new FormData()
        for (const [key, value] of Object.entries({ domain: 'shop.acme.test', serviceId: 'service', environmentId: 'env', tlsMode: 'none', protectionMode: mode, routePassword: 'fixture-password' })) form.set(key, value)
        for (const [url, secret] of [['https://bower.test', ''], ['https://bower.test', 'x'.repeat(31)], ['', 'x'.repeat(32)]]) {
          process.env.BOWER_PUBLIC_URL = url
          process.env.BOWER_ROUTE_AUTH_SECRET = secret
          writes = 0
          const result = await mutate(form)
          assert.match(result?.error ?? '', /BOWER_PUBLIC_URL and a BOWER_ROUTE_AUTH_SECRET of at least 32 characters/)
          assert.equal(writes, 0)
        }
        process.env.BOWER_PUBLIC_URL = 'https://bower.test'
        process.env.BOWER_ROUTE_AUTH_SECRET = 'x'.repeat(32)
        assert.equal(await mutate(form), undefined)
        assert.equal(writes, 1)
        process.env.BOWER_PUBLIC_URL = ''
        process.env.BOWER_ROUTE_AUTH_SECRET = ''
        form.set('protectionMode', 'none')
        writes = 0
        assert.equal(await mutate(form), undefined)
        assert.equal(writes, 1)
      }
    }
  } finally {
    if (originalUrl === undefined) delete process.env.BOWER_PUBLIC_URL
    else process.env.BOWER_PUBLIC_URL = originalUrl
    if (originalSecret === undefined) delete process.env.BOWER_ROUTE_AUTH_SECRET
    else process.env.BOWER_ROUTE_AUTH_SECRET = originalSecret
  }
})

test('audit recording preserves automation attribution and infers legacy user/system actors', async () => {
  const writes: Record<string, unknown>[] = []
  const shared = load<typeof import('./actions/shared')>('src/lib/actions/shared.ts', {
    'next/headers': {}, '@/lib/auth': {}, '@/lib/queries': {},
    '@/db': { db: { insert: () => ({ values: async (value: Record<string, unknown>) => { writes.push(value) } }) } },
  })
  const base = { orgId: 'org', action: 'deployment.manual', resourceType: 'deployment', resourceId: 'deployment' }
  await shared.recordAudit({ ...base, userId: 'alex', actorType: 'api_key', apiKeyId: 'github-actions' })
  await shared.recordAudit({ ...base, userId: null, actorType: 'webhook' })
  await shared.recordAudit({ ...base, userId: 'sam' })
  await shared.recordAudit({ ...base, userId: null })
  assert.deepEqual(writes.map(({ actorType, apiKeyId, userId }) => [actorType, apiKeyId, userId]), [
    ['api_key', 'github-actions', 'alex'], ['webhook', null, null], ['user', null, 'sam'], ['system', null, null],
  ])
})

test('automation deploys write API key or webhook actors and human-readable service/environment details', async () => {
  const audits: Record<string, unknown>[] = []
  const row = { project: { orgId: 'org' }, service: { slug: 'web', name: 'Storefront' }, environment: { name: 'Production', trellisNamespace: 'commerce-production' }, config: { image: 'app:v3', deploymentStrategy: 'rolling' }, spec: { name: 'web' } }
  let reads = 0
  const actions = load<typeof import('./actions/services')>('src/lib/actions/services.ts', {
    'next/navigation': navigation, 'next/cache': { revalidatePath() {} },
    '@/lib/auth': {}, '@/lib/queries': {}, '@/lib/managed-proxy': {}, '@/lib/deployment-reconciler': {}, '@/lib/trellis-cleanup': {},
    '@/lib/actions/shared': { recordAudit: async (entry: Record<string, unknown>) => { audits.push(entry) } },
    '@/lib/deployment-runtime': { createDeploymentSpec: async () => row, notifyDeployment: async () => {}, recordDeploymentEvent: async () => {} },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ planJob: async () => ({}), applyJobPlan: async () => ({ incarnation: 'inc', version: 8, revision: 3 }) }) },
    '@/db': { db: {
      select: () => query(++reads % 2 ? [{ config: { id: 'config', overrides: {} } }] : []),
      insert: () => ({ values: () => ({ returning: async () => [{ id: 'deployment' }] }) }),
      update: () => ({ set: () => ({ where: async () => {} }) }),
    } },
  })
  await actions.deployServiceFromAutomation('service', 'env', 'app:v3', 'manual', { actorType: 'api_key', apiKeyId: 'key', userId: 'alex' })
  await actions.deployServiceFromAutomation('service', 'env', 'app:v3', 'webhook', { actorType: 'webhook' })
  assert.deepEqual(audits.map(({ actorType, apiKeyId, userId, action }) => [actorType, apiKeyId, userId, action]), [
    ['api_key', 'key', 'alex', 'deployment.manual'], ['webhook', null, null, 'deployment.webhook'],
  ])
  for (const audit of audits) {
    const details = audit.details as Record<string, unknown>
    assert.equal(details.serviceName, 'Storefront')
    assert.equal(details.environmentName, 'Production')
  }
})

test('historical audit details resolve names and never fall back to service/environment UUIDs', async () => {
  const results = [
    [{ entry: { details: { serviceId: 'svc-id', environmentId: 'env-id' } } }, { entry: { details: { serviceId: 'deleted-id', environmentId: 'deleted-env' } } }, { entry: { details: { serviceId: 'svc-id', serviceName: 'Original name' } } }],
    [{ id: 'svc-id', name: 'Storefront' }], [{ id: 'env-id', name: 'Production' }],
  ]
  const queries = load<typeof import('./queries')>('src/lib/queries.ts', {
    'next/headers': {}, '@/db': { db: { select: () => query(results.shift()!) } },
  })
  const rows = await queries.getAuditLog('org', null)
  assert.equal((rows[0].entry.details as Record<string, unknown>).serviceName, 'Storefront')
  assert.equal((rows[0].entry.details as Record<string, unknown>).environmentName, 'Production')
  assert.equal((rows[1].entry.details as Record<string, unknown>).serviceName, 'Deleted service')
  assert.equal((rows[1].entry.details as Record<string, unknown>).environmentName, 'Deleted environment')
  assert.equal((rows[2].entry.details as Record<string, unknown>).serviceName, 'Original name')
})

test('combined member role save enforces authorization and last owner/admin protection before writing', async () => {
  let instanceAdmin = true
  let orgRole = 'owner'
  let results: unknown[][] = []
  const writes: Record<string, unknown>[] = []
  const tx = { update: () => ({ set: (value: Record<string, unknown>) => ({ where: async () => { writes.push(value) } }) }) }
  const actions = load<typeof import('./actions/settings')>('src/lib/actions/settings.ts', {
    'next/cache': { revalidatePath() {} }, 'next/headers': {}, '@/lib/invitations': {},
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'requester' }) },
    '@/lib/queries': { getUserOrganization: async () => ({ ...context, role: orgRole }), isInstanceAdmin: async () => instanceAdmin },
    './shared': { recordAudit: async () => {} },
    '@/db': { db: { select: () => query(results.shift()!), transaction: async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx) } },
  })
  const membership = { id: 'membership', orgId: 'org', userId: 'target', role: 'owner' }
  const target = { id: 'target', isInstanceAdmin: true }
  const input = { membershipId: 'membership', organizationRole: 'member' as const, instanceAdmin: false }
  results = [[membership], [target], [{ id: 'target' }]]
  assert.match((await actions.updateMemberRolesAction(input)).error!, /at least one owner/)
  results = [[{ ...membership, role: 'member' }], [target], [{ id: 'target' }]]
  assert.match((await actions.updateMemberRolesAction(input)).error!, /at least one administrator/)
  instanceAdmin = false
  results = [[{ ...membership, role: 'member' }], [target]]
  assert.match((await actions.updateMemberRolesAction(input)).error!, /Instance administrator access required/)
  orgRole = 'member'
  assert.match((await actions.updateMemberRolesAction(input)).error!, /Only organization owners/)
  assert.equal(writes.length, 0)
  instanceAdmin = true
  results = [[membership], [target], [{ id: 'target' }, { id: 'other-owner' }], [{ id: 'target' }, { id: 'requester' }]]
  assert.equal((await actions.updateMemberRolesAction(input)).success, true)
  assert.equal(writes[0].role, 'member')
  assert.equal(writes[1].isInstanceAdmin, false)
})

test('Trellis-unavailable banner shows while the condition holds, with its actions beside the text', () => {
  const { TrellisReadErrorProvider } = load<typeof import('../components/trellis-read-error')>('src/components/trellis-read-error.tsx', { 'next/navigation': navigation })
  assert.doesNotMatch(renderToStaticMarkup(TrellisReadErrorProvider({ message: null, children: createElement('main') })), /Trellis is unavailable/)

  const html = renderToStaticMarkup(TrellisReadErrorProvider({ message: 'Connection refused.', children: createElement('main') }))
  assert.match(html, /role="status"/)
  assert.match(html, /bg-warn-50/)
  assert.doesNotMatch(html, /Dismiss/)
  const text = html.match(/<div class="min-w-0"><span class="font-semibold">Trellis is unavailable\.<\/span><span class="ml-1">Connection refused\.<\/span><\/div>/)
  assert.ok(text, html)
  const action = html.slice(text.index! + text[0].length)
  assert.match(action, /^<div class="flex shrink-0[^"]*"><button[^>]*>Retry connection<\/button><a [^>]*href="\/settings\/organization#connection"[^>]*>Check connection settings<\/a><\/div>/)
})

test('service actions return safe messages for expected failures, since React redacts thrown errors in production', async () => {
  let restart: () => Promise<unknown> = async () => {}
  let role = 'admin'
  const actions = load<typeof import('./actions/services')>('src/lib/actions/services.ts', {
    'next/navigation': navigation, 'next/cache': { revalidatePath() {} },
    '@/lib/auth': {}, '@/lib/queries': {},
    '@/lib/actions/shared': { requireService: async () => ({ ...access, projectRole: role, service: { slug: 'web', name: 'Web' }, project: { slug: 'demo' } }), recordAudit: async () => {} },
    '@/lib/managed-proxy': {}, '@/lib/deployment-reconciler': {}, '@/lib/deployment-runtime': {},
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ restartJob: () => restart() }) },
    '@/db': { db: { select: () => query([{ config: { activeJobName: 'web' }, environment: { trellisNamespace: 'demo', name: 'Production' } }]) } },
  })

  assert.equal((await actions.restartServiceAction('service', 'env')).error, undefined)

  restart = async () => { throw new TrellisApiError(422, 'Unprocessable', '{"error":"token=secret-value at https://user:pw@trellis.internal"}') }
  assert.equal((await actions.restartServiceAction('service', 'env')).error, 'Trellis rejected the request (422).')

  restart = async () => { throw new TrellisApiError(403, 'Forbidden', 'denied') }
  assert.equal((await actions.restartServiceAction('service', 'env')).error, 'Trellis denied this request. Check the cluster credentials.')

  role = 'viewer'
  assert.equal((await actions.restartServiceAction('service', 'env')).error, 'Insufficient permissions.')

  // Unexpected failures still throw, so their details never leave the server.
  role = 'admin'
  restart = async () => { throw new Error('connect ECONNREFUSED 10.0.0.4:5432') }
  await assert.rejects(actions.restartServiceAction('service', 'env'), /ECONNREFUSED/)
})
