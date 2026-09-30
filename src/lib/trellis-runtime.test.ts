import assert from 'node:assert/strict'
import test from 'node:test'
import { allocationBelongsToService, observedProxyStatus, trellisReadError } from './trellis-runtime'
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
