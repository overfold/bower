import assert from 'node:assert/strict'
import test from 'node:test'
import { allocationFields, allocationNotice, lifecycleEventTitle, lifecycleEventTone } from './allocation-lifecycle'

test('every failed or lost lifecycle event is toned, and the vocabulary keeps Failed and Lost distinct', () => {
  assert.equal(lifecycleEventTone({ phase: 'failed' }, false), 'danger')
  assert.equal(lifecycleEventTone({ phase: 'lost' }, false), 'danger')
  assert.equal(lifecycleEventTone({ phase: 'running' }, false), 'neutral')
  assert.equal(lifecycleEventTone({ phase: 'running' }, true), 'success')
  assert.equal(lifecycleEventTitle({ phase: 'failed' }), 'Failed')
  assert.equal(lifecycleEventTitle({ phase: 'lost' }), 'Lost')
  assert.equal(lifecycleEventTitle({ phase: 'placed' }, 'node-1'), 'Placed on node-1')
})

test('the allocation notice surfaces the cause for failing, pending, and draining allocations only', () => {
  const base = { health: 'unknown' as const, draining: false }
  assert.deepEqual(allocationNotice({ ...base, phase: 'failed', message: 'Process exited with code 1' }), { tone: 'danger', title: 'Failed', text: 'Process exited with code 1' })
  assert.equal(allocationNotice({ ...base, phase: 'lost', reason: 'node_lost' })?.text, 'node lost')
  assert.equal(allocationNotice({ phase: 'running', health: 'unhealthy', draining: false })?.title, 'Unhealthy')
  assert.equal(allocationNotice({ ...base, phase: 'pending', reason: 'insufficient_cpu' })?.text, 'Awaiting placement: insufficient cpu')
  assert.equal(allocationNotice({ ...base, phase: 'running', health: 'healthy', reason: 'started' }), null)
})

test('allocation counters are never labelled Restarts', () => {
  assert.equal(allocationFields.generation.label, 'Generation')
  assert.equal(allocationFields.attempt.label, 'Attempt')
})
