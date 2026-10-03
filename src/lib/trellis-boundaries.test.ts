import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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
    where(sql: SQL) { onWhere?.(sql); return this }, limit() { return this },
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
    '@/db': { db: { select: () => query(rows.shift()!), delete: () => { deleted = true; return query([]) } } },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({ deleteJob: async () => { throw new Error('offline') }, deleteSecret: async () => {} }) },
  })
  assert.match((await actions.deleteProjectAction('project')).error!, /not deleted/)
  assert.equal(deleted, false)
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

test('managed proxy acceptance stays pending with cluster/read; failed cleanup retains its record', async () => {
  const statuses: string[] = []
  let definitions: unknown[] = [{ route: { id: 'route', protectionMode: 'none', headers: {}, responseHeaders: {}, redirects: [] }, service: { slug: 'web' }, config: {} }]
  let deleted = false
  let selectIndex = 0
  const sync = load<typeof import('./managed-proxy')>('src/lib/managed-proxy.ts', {
    '@/db': { db: {
      select: () => query([[{ id: 'env', trellisNamespace: 'production' }], [{ id: 'project' }], definitions][selectIndex++ % 3]),
      insert: () => ({ values: (values: { status: string }) => { statuses.push(values.status); return { onConflictDoUpdate: async () => {} } } }),
      update: () => ({ set: (values: { status: string }) => { statuses.push(values.status); return query([]) } }),
      delete: () => { deleted = true; return query([]) },
    } },
    '@/lib/trellis-instance': { getTrellisClient: async () => ({
      setSecret: async () => {}, planJob: async () => ({ action: 'create' }),
      applyJobPlan: async (spec: { task_groups: Array<{ api_access: unknown }> }) => assert.deepEqual(JSON.parse(JSON.stringify(spec.task_groups[0].api_access)), { scope: 'cluster', access: 'read' }),
      deleteJob: async () => { throw new TrellisApiError(403, 'Forbidden', 'denied') }, deleteSecret: async () => {},
    }) },
  })
  await sync.syncManagedProxy('project', 'env', 'org')
  assert.deepEqual(statuses, ['pending'])
  definitions = []
  await assert.rejects(sync.syncManagedProxy('project', 'env', 'org'), /403/)
  assert.equal(deleted, false)
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
      getDeploymentsByService: async () => [{ id: 'deployment', environmentId: 'env', trellisVersion: 12, trellisRevision: 7, trellisJobName: 'web', status: 'healthy', createdAt: '2026-10-01T10:00:00Z' }],
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
  assert.match(html, /unhealthy/)
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
      getServiceBySlug: async () => ({ id: 'service', slug: 'web' }),
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
    renderToStaticMarkup(await layout.default({ children: createElement('div'), params: Promise.resolve({ slug: 'demo', serviceSlug: 'web' }) }))
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
  await actions.rollbackServiceAction('service', 'env', 'selected-deployment')
  assert.equal(applied.length, 2)
  for (const spec of applied) assert.equal(JSON.stringify(spec), JSON.stringify(selected))
  assert.deepEqual(targetSql?.params, ['selected-deployment', 'service', 'env', 'healthy'])
  targetAvailable = false; reads = 0
  await assert.rejects(actions.rollbackServiceAction('service', 'env', 'foreign-deployment'), /no successful stored JobSpec/)
  assert.equal(applied.length, 2)
  role = 'viewer'
  await assert.rejects(actions.rollbackServiceAction('service', 'env', 'selected-deployment'), /permissions/)
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
