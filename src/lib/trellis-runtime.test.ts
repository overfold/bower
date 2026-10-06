import assert from 'node:assert/strict'
import test from 'node:test'
import { allocationBelongsToService, managedProxyObservation, nodeAllocatable, nodeCapacity, observationFreshness, observedProxyStatus, pendingReasonCounts, trellisReadError, trellisWriteError } from './trellis-runtime'
import { cleanupTrellisResources } from './trellis-cleanup'
import { TrellisApiError } from './trellis'
import type { TrellisAllocation } from '@/types/trellis'

const allocation = { namespace: 'production', job: 'web-blue', phase: 'running', health: 'healthy' } as TrellisAllocation

test('ownership binds active job names to their own namespace, even with matching service labels', () => {
  assert.equal(allocationBelongsToService(allocation, 'production', 'web', ['web', 'web-blue']), true)
  assert.equal(allocationBelongsToService({ ...allocation, labels: { 'bower/service': 'web' } }, 'staging', 'web', ['web-blue']), false)
  assert.equal(allocationBelongsToService(allocation, 'production', 'other', ['other']), false)
})

test('proxy observation distinguishes accepted, starting, unknown, unhealthy and recovered allocations', () => {
  const proxy = { ...allocation, job: 'bower-proxy' }
  const status = (allocations: TrellisAllocation[]) => observedProxyStatus(allocations, 'production', 'bower-proxy')
  assert.equal(status([]), 'pending')
  assert.equal(status([{ ...proxy, phase: 'pending' }]), 'pending')
  assert.equal(status([{ ...proxy, phase: 'starting' }]), 'pending')
  assert.equal(status([{ ...proxy, health: 'unknown' }]), 'pending')
  assert.equal(status([{ ...proxy, health: 'unhealthy', reason: 'route-sync check failed' }]), 'unhealthy')
  assert.equal(status([{ ...proxy, phase: 'failed' }]), 'unhealthy')
  assert.equal(status([proxy, { ...proxy, phase: 'failed' }]), 'running')
  assert.equal(status([{ ...proxy, namespace: 'staging' }]), 'pending')
})

test('target proxy convergence does not confuse a healthy old revision with the submitted target', () => {
  const proxy = { ...allocation, job: 'bower-proxy' }
  const old = { ...proxy, labels: { 'bower/config-hash': 'old' } }
  const target = { ...proxy, phase: 'starting', health: 'unknown', labels: { 'bower/config-hash': 'new' } } as TrellisAllocation
  assert.deepEqual(managedProxyObservation([old, target], 'production', 'bower-proxy', 'new'), {
    status: 'pending', convergence: 'updating', diagnostic: undefined,
  })
  assert.deepEqual(managedProxyObservation([{ ...target, phase: 'running', health: 'healthy' }], 'production', 'bower-proxy', 'new'), {
    status: 'running', convergence: 'converged',
  })
  assert.equal(managedProxyObservation([{ ...target, health: 'unhealthy', message: 'route-sync discovery failed' }], 'production', 'bower-proxy', 'new').failureKind, 'route-sync')
})

test('node resources preserve allocatable scheduling semantics and mark absent or old samples', () => {
  const node = { cpu: 1800, memory: 8_000, cpu_capacity: 2000, memory_capacity: 10_000, cpu_allocatable: 1750, memory_allocatable: 7_500 } as never
  assert.deepEqual(nodeAllocatable(node), { cpu: 1750, memory: 7_500 })
  assert.deepEqual(nodeCapacity(node), { cpu: 2000, memory: 10_000 })
  assert.equal(observationFreshness(undefined), 'unknown')
  assert.equal(observationFreshness('2026-10-01T10:00:00Z', Date.parse('2026-10-01T10:00:59Z')), 'fresh')
  assert.equal(observationFreshness('2026-10-01T10:00:00Z', Date.parse('2026-10-01T10:01:01Z')), 'stale')
})

test('pending reason summaries count explicit reasons separately from unknown placement', () => {
  assert.deepEqual(pendingReasonCounts([
    { phase: 'pending', reason: 'insufficient_cpu' },
    { phase: 'pending', reason: 'insufficient_cpu' },
    { phase: 'pending' },
    { phase: 'running', reason: 'insufficient_cpu' },
  ] as TrellisAllocation[]), [
    { reason: 'insufficient_cpu', count: 2 },
    { reason: 'awaiting_placement', count: 1 },
  ])
})

test('cleanup tolerates absent resources but rejects forbidden/unreachable resources after settling all requests', async () => {
  await cleanupTrellisResources([Promise.resolve(), Promise.reject(new TrellisApiError(404, 'Not Found', 'absent'))])
  for (const failure of [new TrellisApiError(403, 'Forbidden', 'denied'), new Error('offline')]) {
    let completed = false
    await assert.rejects(cleanupTrellisResources([
      Promise.reject(failure), new Promise((resolve) => setTimeout(() => { completed = true; resolve(undefined) }, 5)),
    ]), (error: unknown) => error === failure)
    assert.equal(completed, true)
  }
})

test('read errors retain useful status categories without leaking upstream details', () => {
  assert.match(trellisReadError(new TrellisApiError(403, 'Forbidden', 'sensitive body')), /denied access/)
  assert.match(trellisReadError(new TrellisApiError(404, 'Not Found', 'sensitive body')), /404/)
  assert.match(trellisReadError(new TrellisApiError(422, 'Invalid', 'sensitive body')), /422/)
  assert.doesNotMatch(trellisReadError(new Error('https://user:secret@example')), /secret|example/)
})

test('write errors name credentials problems generically and explain client errors with Trellis’s own short reason', () => {
  assert.equal(trellisWriteError(new TrellisApiError(401, 'Unauthorized', '{"error":"bad token"}')), 'Trellis denied this request. Check the cluster credentials.')
  assert.equal(trellisWriteError(new TrellisApiError(405, 'Method Not Allowed', '{"error":"job is not restartable while a deployment is in progress"}')), 'Trellis rejected the request (405): job is not restartable while a deployment is in progress')
  assert.equal(trellisWriteError(new TrellisApiError(422, 'Invalid', '{"error":"memory   must be\\nat least 64 MiB"}')), 'Trellis rejected the request (422): memory must be at least 64 MiB')
})

test('write errors never show arbitrary bodies, server errors, secrets, addresses, or unbounded text', () => {
  const hidden = (status: number, body: string) => assert.equal(trellisWriteError(new TrellisApiError(status, 'x', body)), `Trellis rejected the request (${status}).`)
  hidden(422, 'sensitive plain-text body')
  hidden(422, '{"detail":"no error field"}')
  hidden(500, '{"error":"database exploded"}')
  hidden(409, '{"error":"failed calling https://trellis.internal:8443/v1/jobs"}')
  hidden(409, '{"error":"cannot reach 10.0.4.17"}')
  hidden(400, '{"error":"Authorization: Bearer abcdef"}')
  hidden(400, '{"error":"token=abc123"}')
  hidden(400, '{"error":"image pull secret AKIAIOSFODNN7EXAMPLEAKIAIOSFODNN7EXAMPLE rejected"}')
  hidden(400, '{"error":42}')
  const long = trellisWriteError(new TrellisApiError(400, 'Bad', JSON.stringify({ error: `${'word '.repeat(100)}` })))
  assert.ok(long.length <= 'Trellis rejected the request (400): '.length + 200, long)
  assert.match(long, /…$/)
})
