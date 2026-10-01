import assert from 'node:assert/strict'
import test from 'node:test'
import { TrellisApiError, TrellisClient } from './trellis'
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
  assert.deepEqual(connection.headers, { Authorization: 'Bearer fixture-token', Connection: 'Upgrade', Upgrade: 'trellis-exec.v1' })
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
  const spec: TrellisJobSpec = { name: 'web', namespace: 'production', task_groups: [] }
  const plan = { action: 'update' as const, namespace: 'production', job: 'web', base_incarnation: 'inc-a', base_version: 4, base_revision: 3, desired_allocations: 0, changes: [] }
  assert.deepEqual(await client.applyJobPlan(spec, 'production', plan), { namespace: 'production', name: 'web', incarnation: 'inc-a', version: 5, revision: 3 })
  await assert.rejects(client.applyJobPlan(spec, 'production', plan), (error: unknown) => error instanceof TrellisApiError && error.status === 409)
  assert.deepEqual(bodies, [
    { spec, expected_version: 4, expected_incarnation: 'inc-a' },
    { spec, expected_version: 4, expected_incarnation: 'inc-a' },
  ])
})
