import assert from 'node:assert/strict'
import test from 'node:test'
import { deploymentConvergence, deploymentDeadlineReached } from './deployment-convergence'
import type { TrellisAllocation, TrellisJob, TrellisJobSpec } from '@/types/trellis'

const identity = { incarnation: 'inc-a', version: 8, revision: 3 }
const spec: TrellisJobSpec = {
  name: 'web',
  namespace: 'production',
  task_groups: [{ name: 'web', count: 2, tasks: [] }],
}

function allocation(id: string, revision: number, phase: TrellisAllocation['phase'], health: TrellisAllocation['health'], extra: Partial<TrellisAllocation> = {}): TrellisAllocation {
  return {
    id, job: 'web', group: 'web', namespace: 'production', node_id: 'node', phase, health,
    draining: false, generation: 1, job_incarnation: identity.incarnation, job_revision: revision, created_at: '', last_transition_at: '',
    attempt: 0, ports: [], labels: {}, ...extra,
  }
}

function job(allocations: TrellisAllocation[], extra: Partial<TrellisJob> = {}): TrellisJob {
  return {
    name: 'web', incarnation: identity.incarnation, version: identity.version, revision: identity.revision,
    desired: 2, running: 2, healthy: 2, allocations, ...extra,
  }
}

test('count-only and canary applies converge on accepted version even when execution revision is unchanged', () => {
  const current = job([
    allocation('a', 3, 'running', 'healthy'),
    allocation('b', 3, 'running', 'healthy'),
  ])
  assert.equal(deploymentConvergence(current, spec, identity).converged, true)
  assert.equal(deploymentConvergence(current, spec, { ...identity, version: 7 }).converged, false)
})

test('partial rolling surge does not borrow healthy old-revision allocations', () => {
  const partial = job([
    allocation('new-a', 3, 'running', 'healthy'),
    allocation('old-a', 2, 'running', 'healthy'),
    allocation('old-b', 2, 'running', 'healthy'),
  ], { desired: 2, running: 1, healthy: 1 })
  const result = deploymentConvergence(partial, spec, identity)
  assert.equal(result.converged, false)
  assert.deepEqual(result.groups, [{ name: 'web', desired: 2, active: 1, healthy: 1 }])
})

test('readiness cannot borrow matching revisions from another lifetime, namespace, job or missing identity', () => {
  for (const extra of [{ job_incarnation: 'inc-old' }, { job_incarnation: undefined }, { namespace: 'staging' }, { job: 'other' }]) {
    const result = deploymentConvergence(job([
      allocation('current', 3, 'running', 'healthy'),
      allocation('wrong', 3, 'running', 'healthy', extra),
    ]), spec, identity)
    assert.equal(result.converged, false)
    assert.deepEqual(result.active.map((entry) => entry.id), ['current'])
  }
})

test('retained failures and stale old allocations are history, not active convergence blockers', () => {
  const complete = job([
    allocation('new-a', 3, 'running', 'healthy'),
    allocation('new-b', 3, 'running', 'healthy'),
    allocation('failed', 3, 'failed', 'unhealthy'),
    allocation('old', 2, 'running', 'healthy'),
    allocation('draining', 3, 'running', 'healthy', { draining: true }),
  ])
  assert.equal(deploymentConvergence(complete, spec, identity).converged, true)
})

test('replacement backoff and nonpending stalls remain nonconverged until the shared deadline', () => {
  const stalled = job([
    allocation('placed', 3, 'placed', 'unknown'),
    allocation('failed', 3, 'failed', 'unhealthy'),
  ], {
    running: 0,
    healthy: 0,
    replacement_backoff: [{ group: 'web', job_revision: 3, failures: 2, last_failure_at: '', next_replacement_at: '' }],
  })
  assert.equal(deploymentConvergence(stalled, spec, identity).converged, false)
  assert.equal(deploymentDeadlineReached('2026-10-01T10:00:00Z', 300, Date.parse('2026-10-01T10:04:59.999Z')), false)
  assert.equal(deploymentDeadlineReached('2026-10-01T10:00:00Z', 300, Date.parse('2026-10-01T10:05:00Z')), true)
})
