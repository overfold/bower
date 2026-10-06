import assert from 'node:assert/strict'
import test from 'node:test'
import { latestFailedDeployments, needsAttentionRows } from './needs-attention'
import type { TrellisAllocation, TrellisJob } from '@/types/trellis'

const now = Date.parse('2026-10-03T12:00:00Z')
const row = (id: string, status: string, age: number, serviceId = 'a') => ({ deployment: { id, serviceId, status, createdAt: new Date(now - age) }, serviceName: serviceId, projectSlug: 'commerce' })
test('fail → succeed disappears, even with unsorted input', () => {
  assert.deepEqual(latestFailedDeployments([row('success', 'healthy', 1000), row('failure', 'failed', 2000)], now), [])
})
test('succeed → fail shows latest failure', () => {
  assert.deepEqual(latestFailedDeployments([row('success', 'healthy', 2000), row('failure', 'failed', 1000)], now).map((r) => r.deployment.id), ['failure'])
})
test('fail → fail shows once per service and respects 24-hour boundary', () => {
  assert.deepEqual(latestFailedDeployments([row('old', 'failed', 3000), row('new', 'failed', 1000), row('boundary', 'failed', 86_400_000, 'b'), row('expired', 'failed', 86_400_001, 'c')], now).map((r) => r.deployment.id), ['new', 'boundary'])
})
test('a latest rolled-back deployment needs attention until a later release supersedes it', () => {
  assert.deepEqual(latestFailedDeployments([row('rolled', 'rolled_back', 1000)], now).map((r) => r.deployment.id), ['rolled'])
  assert.deepEqual(latestFailedDeployments([row('rolled', 'rolled_back', 2000), row('ok', 'healthy', 1000)], now), [])
})

const iso = (age: number) => new Date(now - age).toISOString()
const allocation = (over: Partial<TrellisAllocation>) => ({ id: 'alloc', job: 'worker', group: 'app', namespace: 'production', node_id: 'n1', phase: 'running', health: 'healthy', draining: false, generation: 1, job_revision: 3, created_at: iso(600_000), last_transition_at: iso(600_000), attempt: 1, ports: [], labels: {}, ...over }) as TrellisAllocation
const target = { serviceId: 'svc-worker', namespace: 'production', job: 'worker', serviceSlug: 'worker', serviceName: 'Order Worker', projectSlug: 'commerce' }
const job = (backoff: NonNullable<TrellisJob['replacement_backoff']>) => ({ name: 'worker', spec: { namespace: 'production' }, replacement_backoff: backoff }) as unknown as TrellisJob
const backoff = { group: 'app', job_revision: 3, failures: 4, last_failure_at: iso(5_000), message: 'Worker could not reach database', next_replacement_at: iso(-30_000) }

test('one row per service shows the most specific cause, the earliest failure, and one action', () => {
  const rows = needsAttentionRows({
    deployments: [{ ...row('dep', 'failed', 3_600_000, 'svc-worker'), serviceName: 'Order Worker', failureMessage: 'Image pull failed' }],
    allocations: [allocation({ id: 'a-1', phase: 'failed', message: 'Process exited with code 1; replacement scheduled', last_transition_at: iso(300_000) }), allocation({ id: 'a-2', phase: 'failed', message: 'Process exited with code 1; replacement scheduled', last_transition_at: iso(2_000) })],
    jobs: [job([backoff])], targets: [target], now,
  })
  assert.equal(rows.length, 1)
  const [merged] = rows
  assert.equal(merged.cause, 'Worker could not reach database')
  assert.equal(merged.status, 'failing')
  assert.equal(merged.specificId, 'a-2')
  assert.equal(merged.action, 'View logs')
  assert.match(merged.href, /allocations\/a-2$/)
  // Failing since is the earliest failure, not the latest transition.
  assert.equal(new Date(merged.since as string).getTime(), now - 300_000)
})

test('failed deployment rows use the failure message, and rollbacks read as automatic', () => {
  const failed = needsAttentionRows({ deployments: [{ ...row('dep', 'failed', 1000, 'svc-worker'), failureMessage: 'Image pull failed' }], allocations: [], jobs: [], targets: [target], now })
  assert.equal(failed[0].cause, 'Image pull failed')
  assert.equal(failed[0].action, 'View diagnostics')
  const rolledBack = needsAttentionRows({ deployments: [{ ...row('dep', 'rolled_back', 1000, 'svc-worker'), failureMessage: 'Deadline elapsed' }], allocations: [], jobs: [], targets: [target], now })
  assert.equal(rolledBack[0].status, 'rolled_back')
  assert.equal(rolledBack[0].cause, 'Rolled back automatically: Deadline elapsed')
  assert.equal(needsAttentionRows({ deployments: [row('dep', 'failed', 1000, 'svc-worker')], allocations: [], jobs: [], targets: [target], now })[0].cause, 'Deployment failed')
})

test('allocations stuck pending are flagged with Trellis’s reason, fresh ones are not', () => {
  const stuck = needsAttentionRows({ deployments: [], allocations: [allocation({ id: 'p-1', phase: 'pending', health: 'unknown', reason: 'insufficient_cpu', message: 'No node has 2 CPU free', created_at: iso(10_000), last_transition_at: iso(10_000) })], jobs: [], targets: [target], now })
  assert.equal(stuck.length, 1)
  assert.equal(stuck[0].cause, 'No node has 2 CPU free')
  // Nothing has run, so there are no logs to view: the action opens the allocation.
  assert.equal(stuck[0].action, 'View allocation')
  assert.equal(needsAttentionRows({ deployments: [], allocations: [allocation({ phase: 'pending', health: 'unknown', created_at: iso(5_000), last_transition_at: iso(5_000) })], jobs: [], targets: [target], now }).length, 0)
  const slow = needsAttentionRows({ deployments: [], allocations: [allocation({ phase: 'pending', health: 'unknown', created_at: iso(120_000), last_transition_at: iso(120_000) })], jobs: [], targets: [target], now })
  assert.equal(slow[0].cause, 'Awaiting placement')
})

test('rows sort by severity: failing services, then failed deployments, then rollbacks', () => {
  const other = { ...target, serviceId: 'svc-web', job: 'web', serviceSlug: 'web', serviceName: 'Web' }
  const third = { ...target, serviceId: 'svc-api', job: 'api', serviceSlug: 'api', serviceName: 'API' }
  const rows = needsAttentionRows({
    deployments: [row('rb', 'rolled_back', 1000, 'svc-api'), row('f', 'failed', 1000, 'svc-web')],
    allocations: [allocation({ phase: 'failed', message: 'boom' })], jobs: [], targets: [target, other, third], now,
  })
  assert.deepEqual(rows.map((entry) => entry.serviceName), ['Order Worker', 'Web', 'API'])
})
