import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { TrellisApiError, TrellisClient } from './trellis'

test('Trellis validation responses preserve paths and categories in the presented error', () => {
  const error = new TrellisApiError(422, 'Unprocessable Entity', JSON.stringify({
    error: 'job is invalid',
    issues: [
      { path: 'task_groups[web].count', code: 'limit_exceeded', message: 'exceeds operator limit of 2 replicas' },
      { path: 'task_groups[web].tasks[web].volumes[0].container_path', code: 'reserved', message: 'volume path is reserved' },
    ],
  }))
  assert.match(error.message, /task_groups\[web\]\.count: \[limit_exceeded\]/)
  assert.match(error.message, /container_path: \[reserved\]/)
  assert.equal(error.json?.error, 'job is invalid')
})
import type { TrellisJobSpec } from '@/types/trellis'

test('non-exec resources use encoded namespace paths without namespace headers', async (t) => {
  const requests: Array<{ url: string; options?: RequestInit }> = []
  t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    requests.push({ url, options })
    return new Response('[]')
  })
  const client = new TrellisClient(' trellis:8128/// ', 'test-token')
  const ns = 'project/staging'
  const name = 'web/app'
  const spec: TrellisJobSpec = { name, namespace: ns, task_groups: [] }
  await client.listJobs(ns)
  await client.getJob(name, ns)
  await client.planJob(spec, ns)
  await client.applyJob(spec, ns)
  await client.deleteJob(name, ns)
  await client.restartJob(name, ns)
  await client.resetReplacementBackoff(name, 'api/group', ns)
  await client.getJobVersions(name, ns)
  await client.listAllocations({ namespace: ns, job: name, label: 'bower/service=web app' })
  await client.stopAllocation('alloc/id', ns)
  await client.getAllocationEvents('alloc/id', ns)
  await client.getAllocationMetrics('alloc/id', ns)
  await client.getAllocationLogs('alloc/id', 'task name', ns, 17)
  const controller = new AbortController()
  await client.streamEvents(ns, controller.signal)
  assert.deepEqual(requests.map(({ url, options }) => [options?.method ?? 'GET', url.replace('https://trellis:8128/v1/namespaces/project%2Fstaging', '')]), [
    ['GET', '/jobs'], ['GET', '/jobs/web%2Fapp'], ['POST', '/jobs/plan'], ['POST', '/jobs'],
    ['DELETE', '/jobs/web%2Fapp'], ['POST', '/jobs/web%2Fapp/restart'], ['POST', '/jobs/web%2Fapp/groups/api%2Fgroup/replacement-backoff/reset'], ['GET', '/jobs/web%2Fapp/versions'],
    ['GET', '/allocations?label=bower%2Fservice%3Dweb+app&job=web%2Fapp'], ['DELETE', '/allocations/alloc%2Fid'],
    ['GET', '/allocations/alloc%2Fid/events'], ['GET', '/allocations/alloc%2Fid/metrics'],
    ['GET', '/allocations/alloc%2Fid/logs?task=task+name&tail=17'], ['GET', '/events'],
  ])
  assert.equal(requests[13].options?.signal, controller.signal)
  for (const { options } of requests) {
    const headers = new Headers(options?.headers)
    assert.equal(headers.get('authorization'), 'Bearer test-token')
    assert.equal(headers.has('x-trellis-namespace'), false)
  }
  assert.deepEqual(JSON.parse(String(requests[3].options?.body)), { spec })
})

test('plan and apply requests forward explicit resolved image pins exactly', async (t) => {
  const bodies: unknown[] = []
  t.mock.method(globalThis, 'fetch', async (_url: string, options?: RequestInit) => {
    bodies.push(JSON.parse(String(options?.body)))
    return Response.json({})
  })
  const client = new TrellisClient('https://api', 'token')
  const spec: TrellisJobSpec = {
    name: 'web',
    namespace: 'production',
    task_groups: [{ name: 'web', count: 1, tasks: [{ name: 'web', image: 'registry.example/web:mutable' }] }],
  }
  const pins = { 'registry.example/web:mutable': 'registry.example/web@sha256:planned' }
  await client.planJob(spec, 'production', pins)
  await client.applyJob(spec, 'production', { expectedVersion: 7, expectedIncarnation: 'inc-a' }, pins)
  assert.deepEqual(bodies, [
    {
      spec: { name: 'web', namespace: 'production', task_groups: [{ name: 'web', count: 1, tasks: [{ name: 'web', image: 'registry.example/web@sha256:planned' }] }] },
      resolved_images: { 'registry.example/web@sha256:planned': 'registry.example/web@sha256:planned' },
    },
    { spec, resolved_images: pins, expected_version: 7, expected_incarnation: 'inc-a' },
  ])
})

test('cluster settings are read with GET and never expose a write client method', async (t) => {
  const requests: Array<[string, string]> = []
  t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    requests.push([options?.method ?? 'GET', new URL(url).pathname])
    return Response.json({ job_limits: {}, reconciliation: {}, network: {} })
  })
  const client = new TrellisClient('https://api:8128', 'token')
  await client.getClusterSettings()
  assert.deepEqual(requests, [['GET', '/v1/cluster/settings']])
  assert.equal('updateClusterSettings' in client, false)
})

test('exec descriptors share normalized addresses and encoded resource ownership paths', () => {
  const client = new TrellisClient(' trellis:8128/// ', 'fixture-token')
  const connection = client.getExecConnection('alloc/id', 'project/staging', 'task name', 93, 27)
  const url = new URL(connection.url)
  assert.equal(url.origin, 'https://trellis:8128')
  assert.equal(url.pathname, '/v1/namespaces/project%2Fstaging/allocations/alloc%2Fid/exec')
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    stdin: 'true', tty: 'true', term: 'xterm-256color', cols: '93', rows: '27', command: '/bin/sh', task: 'task name',
  })
  assert.deepEqual(connection.headers, { Authorization: 'Bearer fixture-token' })
  assert.equal(new URL(client.getExecConnection('a', 'production', undefined, 83, 31).url).searchParams.has('task'), false)
  assert.throws(() => client.getExecConnection('a', '', undefined, 83, 31), /namespace is required/)
})

test('schemeless workload addresses use HTTPS and carry only their injected CA', async (t) => {
  let request: { url: string; options?: RequestInit & { dispatcher?: unknown } } | undefined
  t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit & { dispatcher?: unknown }) => {
    request = { url, options }
    return Response.json([])
  })
  const client = new TrellisClient('trellis:8128', 'rotated-token', 'injected-ca')
  await client.listNodes()
  assert.equal(request?.url, 'https://trellis:8128/v1/nodes')
  assert.ok(request?.options?.dispatcher)
  assert.equal(client.getExecConnection('a', 'production', undefined, 80, 24).ca, 'injected-ca')
})

test('identical jobs in different namespaces never use cluster allocation listing; dashboard deliberately does', async (t) => {
  const paths: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const path = new URL(url).pathname
    paths.push(path)
    return Response.json([{ namespace: path.includes('staging') ? 'staging' : 'production', job: 'web' }])
  })
  const client = new TrellisClient('http://api:8128/', 'token')
  assert.equal((await client.listAllocations({ namespace: 'production', job: 'web' }))[0].namespace, 'production')
  assert.equal((await client.listAllocations({ namespace: 'staging', job: 'web' }))[0].namespace, 'staging')
  await client.listAllocations()
  assert.deepEqual(paths, ['/v1/namespaces/production/allocations', '/v1/namespaces/staging/allocations', '/v1/allocations'])
  await assert.rejects(client.listAllocations({ namespace: '' }), /namespace is required/)
  await assert.rejects(client.getJob('web', ''), /namespace is required/)
})

test('successful empty mutations and API failures retain their distinct contracts', async (t) => {
  const client = new TrellisClient('https://api:8128', 'token')
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }))
  await client.deleteJob('web', 'production')
  fetch.mock.mockImplementation(async () => new Response('', { status: 202 }))
  await client.applyJob({ name: 'web', namespace: 'production', task_groups: [] }, 'production')
  fetch.mock.mockImplementation(async () => new Response('denied', { status: 403, statusText: 'Forbidden' }))
  await assert.rejects(client.getAllocationMetrics('a', 'production'), (error: unknown) => error instanceof TrellisApiError && error.status === 403 && error.body === 'denied')
})

test('plan-derived applies fence competing writers with incarnation and version', async (t) => {
  const bodies: unknown[] = []
  let applies = 0
  t.mock.method(globalThis, 'fetch', async (_url: string, options?: RequestInit) => {
    bodies.push(JSON.parse(String(options?.body)))
    applies++
    if (applies === 2) return new Response('{"message":"version conflict"}', { status: 409, statusText: 'Conflict' })
    return Response.json({ namespace: 'production', name: 'web', incarnation: 'inc-a', version: 5, revision: 3 }, { status: 202 })
  })
  const client = new TrellisClient('https://api', 'token')
  const spec: TrellisJobSpec = {
    name: 'web',
    namespace: 'production',
    task_groups: [{ name: 'web', count: 1, tasks: [{ name: 'web', image: 'registry.example/web:mutable' }] }],
  }
  const pins = { 'registry.example/web:mutable': 'registry.example/web@sha256:reviewed' }
  const plan = { action: 'update' as const, namespace: 'production', job: 'web', base_incarnation: 'inc-a', base_version: 4, base_revision: 3, desired_allocations: 1, changes: [], resolved_images: pins }
  assert.deepEqual(await client.applyJobPlan(spec, 'production', plan), { namespace: 'production', name: 'web', incarnation: 'inc-a', version: 5, revision: 3 })
  await assert.rejects(client.applyJobPlan(spec, 'production', plan), (error: unknown) => error instanceof TrellisApiError && error.status === 409)
  assert.deepEqual(bodies, [
    { spec, resolved_images: pins, expected_version: 4, expected_incarnation: 'inc-a' },
    { spec, resolved_images: pins, expected_version: 4, expected_incarnation: 'inc-a' },
  ])
})

test('rollback plans immutable digests without resolving old tags and conditionally applies no-op plans', async (t) => {
  const spec: TrellisJobSpec = { name: 'web', namespace: 'production', task_groups: [{ name: 'main', count: 1, tasks: [{ name: 'web', image: 'app:mutable' }] }] }
  const oldPins = { 'app:mutable': 'app@sha256:old' }
  const newPins = { 'app:mutable': 'app@sha256:new' }
  const bodies: unknown[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body))
    bodies.push(body)
    if (url.endsWith('/plan')) assert.ok(body.spec.task_groups[0].tasks[0].image.includes('@sha256:'), 'deleted mutable tags must not be resolved while planning')
    return Response.json(url.endsWith('/plan') ? {
      action: 'none', namespace: 'production', job: 'web', base_incarnation: 'inc', base_version: 9, base_revision: 6,
      desired_allocations: 1, changes: [], resolved_images: newPins,
    } : { namespace: 'production', name: 'web', incarnation: 'inc', version: 10, revision: 7 })
  })
  const client = new TrellisClient('https://api', 'token')
  const plan = await client.planJob(spec, 'production', oldPins)
  assert.equal(plan.action, 'update')
  assert.deepEqual(plan.resolved_images, oldPins)
  assert.equal((await client.applyJobPlan(spec, 'production', plan)).version, 10)
  assert.deepEqual(bodies, [
    {
      spec: { name: 'web', namespace: 'production', task_groups: [{ name: 'main', count: 1, tasks: [{ name: 'web', image: 'app@sha256:old' }] }] },
      resolved_images: { 'app@sha256:old': 'app@sha256:old' },
    },
    { spec, resolved_images: oldPins, expected_version: 9, expected_incarnation: 'inc' },
  ])
  const unchanged = await client.planJob(spec, 'production', newPins)
  assert.equal(unchanged.action, 'update')
  await client.applyJobPlan(spec, 'production', unchanged)
  assert.equal(bodies.length, 4, 'digest planning still fences the original-spec apply')
  assert.deepEqual(bodies[3], { spec, resolved_images: newPins, expected_version: 9, expected_incarnation: 'inc' })
})

test('ordinary reads time out before headers and during body consumption, then recover', async (t) => {
  let mode: 'healthy' | 'headers-stalled' | 'body-stalled' = 'healthy'
  const server = createServer((_request, response) => {
    if (mode === 'headers-stalled') return
    response.writeHead(200, { 'Content-Type': 'application/json' })
    if (mode === 'body-stalled') response.write('[')
    else response.end('[]')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const client = new TrellisClient(`http://127.0.0.1:${address.port}`, 'disposable-test-token')
  // Keep the real cancellation path, shortening only the clock for this test.
  const timeout = AbortSignal.timeout.bind(AbortSignal)
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    assert.equal(milliseconds, 10_000)
    return timeout(500)
  })
  assert.deepEqual(await client.listNodes(), [])
  mode = 'headers-stalled'
  await assert.rejects(client.listNodes(), (error: unknown) => error instanceof Error && error.name === 'TimeoutError')
  mode = 'body-stalled'
  await assert.rejects(client.listNodes(), (error: unknown) => error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
  mode = 'healthy'
  assert.deepEqual(await client.listNodes(), [])
})
