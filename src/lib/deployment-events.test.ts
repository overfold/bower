import assert from 'node:assert/strict'
import test from 'node:test'
import { deploymentEventTone, failedAllocationId, failureEvent } from './deployment-events'

test('event tones are explicit by type, not inferred from message text', () => {
  assert.equal(deploymentEventTone('failed'), 'danger')
  assert.equal(deploymentEventTone('auto_rollback'), 'warning')
  assert.equal(deploymentEventTone('replacement_backoff'), 'warning')
  assert.equal(deploymentEventTone('scheduling_blocked'), 'warning')
  assert.equal(deploymentEventTone('healthy'), 'success')
  assert.equal(deploymentEventTone('planning'), 'neutral')
  // A message that merely mentions "error" or "failure" must not turn a neutral event red.
  assert.equal(deploymentEventTone('apply_accepted'), 'neutral')
  assert.equal(deploymentEventTone('something_new'), 'neutral')
})

test('the failure event is the terminal failure, else a diagnostic', () => {
  const events = [
    { type: 'planning', message: 'plan' },
    { type: 'scheduling_blocked', message: 'blocked' },
    { type: 'auto_rollback', message: 'rolled back' },
  ]
  assert.equal(failureEvent(events)?.message, 'rolled back')
  assert.equal(failureEvent(events.slice(0, 2))?.message, 'blocked')
  assert.equal(failureEvent(events.slice(0, 1)), undefined)
})

test('the failed allocation comes from the failure event, then marked allocations, never the first listed', () => {
  const blocked = { type: 'scheduling_blocked', message: 'blocked', details: { allocations: [{ id: 'pending-1', phase: 'pending' }] } }
  const failed = { type: 'failed', message: 'failed', details: { allocations: [{ id: 'old' }, { id: 'crashed' }] } }
  assert.equal(failedAllocationId([blocked, failed]), 'old')
  const rolledBack = { type: 'auto_rollback', message: 'rolled back', details: { convergence: { active: [{ id: 'conv-1' }] } } }
  assert.equal(failedAllocationId([blocked, rolledBack]), 'conv-1')
  const marked = { type: 'canary_step', message: 'step', details: { allocations: [{ id: 'fine', phase: 'running', health: 'healthy' }, { id: 'bad', phase: 'running', health: 'unhealthy' }] } }
  assert.equal(failedAllocationId([marked, { type: 'failed', message: 'x', details: {} }]), 'bad')
  assert.equal(failedAllocationId([{ type: 'replacement_backoff', message: 'b', details: { groups: [{ last_allocation_id: 'looping' }] } }]), 'looping')
  assert.equal(failedAllocationId([{ type: 'planning', message: 'p', details: { allocations: [{ id: 'unrelated' }] } }]), undefined)
})
