import test from 'node:test'
import assert from 'node:assert/strict'
import { getReadyCount, getServiceHealth, allocationHealthSummary, currentJobAllocations, worstServiceHealth } from './service-health'
import type { TrellisAllocation } from '@/types/trellis'

const allocation = (phase: 'running' | 'failed' | 'starting', health: 'healthy' | 'unhealthy' | 'unknown') => ({ phase, health })

test('service health covers healthy, partial, zero-ready, and failed rollout', () => {
  assert.equal(getServiceHealth({ allocations: [allocation('running', 'healthy')], desiredReplicas: 1, deploymentStatus: 'healthy', deployed: true }), 'healthy')
  assert.equal(getServiceHealth({ allocations: [allocation('running', 'healthy')], desiredReplicas: 2, deploymentStatus: 'healthy', deployed: true }), 'degraded')
  assert.equal(getServiceHealth({ allocations: [allocation('failed', 'unhealthy')], desiredReplicas: 1, deploymentStatus: 'failed', deployed: true }), 'down')
  assert.equal(getServiceHealth({ allocations: [allocation('running', 'healthy')], desiredReplicas: 1, deploymentStatus: 'failed', deployed: true }), 'healthy')
  assert.equal(getReadyCount([allocation('running', 'healthy'), allocation('starting', 'unknown')]), 1)
})

test('deployment lifecycle and desired replicas do not override serving health', () => {
  assert.equal(getServiceHealth({ allocations: [], desiredReplicas: 2, deployed: false }), 'never')
  assert.equal(getServiceHealth({ allocations: [], desiredReplicas: 0, deployed: true }), 'stopped')
  assert.equal(getServiceHealth({ allocations: [allocation('starting', 'unknown')], desiredReplicas: 1, deployed: true }), 'deploying')
  assert.equal(getServiceHealth({ allocations: [allocation('running', 'healthy')], desiredReplicas: 1, deploymentStatus: 'deploying', deployed: true }), 'healthy')
  assert.equal(worstServiceHealth(['healthy', 'degraded', 'down']), 'down')
  assert.equal(worstServiceHealth(['healthy', 'unknown']), 'unknown')
})

test('tile and attention include current failures, but not stopped or older job revisions', () => {
  const allocations = [
    { id: 'ready', job: 'web', namespace: 'production', job_revision: 7, phase: 'running', health: 'healthy' },
    { id: 'failed', job: 'web', namespace: 'production', job_revision: 7, phase: 'failed', health: 'unknown' },
    { id: 'old', job: 'web', namespace: 'production', job_revision: 6, phase: 'failed', health: 'unhealthy' },
    { id: 'other', job: 'web', namespace: 'staging', job_revision: 7, phase: 'failed', health: 'unhealthy' },
    { id: 'stopped', job: 'web', namespace: 'production', job_revision: 7, phase: 'stopped', health: 'unhealthy' },
  ] as TrellisAllocation[]
  const current = currentJobAllocations(allocations, [{ name: 'web', revision: 7, spec: { namespace: 'production' } }])
  assert.deepEqual(current.map((a) => a.id), ['ready', 'failed', 'stopped'])
  assert.deepEqual(allocationHealthSummary(current), { total: 2, healthy: 1, failing: 1, transitioning: 0, pending: 0 })
})
