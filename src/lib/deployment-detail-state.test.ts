import assert from 'node:assert/strict'
import test from 'node:test'
import { deploymentDetailState } from './deployment-detail-state'

const deployment = (id: string, status: string, hour: number) => ({ id, status, createdAt: `2026-10-03T${String(hour).padStart(2, '0')}:00:00Z` })

test('a failed deployment superseded by a successful deployment is no longer primary recovery', () => {
  const state = deploymentDetailState([deployment('success', 'healthy', 11), deployment('failed', 'failed', 10)], 'failed')
  assert.equal(state.superseding?.id, 'success')
  assert.equal(state.primaryRecovery, false)
})

test('the newest failed deployment retains primary recovery', () => {
  const state = deploymentDetailState([deployment('failed', 'failed', 11), deployment('success', 'healthy', 10)], 'failed')
  assert.equal(state.superseding, undefined)
  assert.equal(state.primaryRecovery, true)
})

test('failure logs distinguish output, empty output, expired allocations, and unrecorded failures', async () => {
  const { failureLogState } = await import('./deployment-detail-state')
  const base = { allocationsReadable: true, allocationFound: true, lines: [] as string[] }
  assert.deepEqual(failureLogState({ ...base, allocationId: 'a', lines: ['boom'] }), { kind: 'logs', allocationHref: true })
  assert.equal(failureLogState({ ...base, allocationId: 'a' }).kind, 'empty')
  const expired = failureLogState({ ...base, allocationId: 'a', allocationFound: false })
  assert.equal(expired.kind, 'expired')
  assert.equal(expired.allocationHref, false)
  assert.match((expired as { message: string }).message, /logs have expired/)
  assert.equal(failureLogState({ ...base, allocationId: undefined }).allocationHref, false)
  const unreadable = failureLogState({ ...base, allocationId: 'a', allocationsReadable: false, allocationFound: false, error: 'Trellis request failed (500).' })
  assert.equal(unreadable.kind, 'error')
  assert.equal(unreadable.allocationHref, true)
  assert.equal(failureLogState({ ...base, allocationId: 'a', error: 'Trellis request failed (500).' }).kind, 'error')
})

test('the previous successful release is the newest healthy one created before the deployment', async () => {
  const { previousSuccessfulRelease } = await import('./deployment-detail-state')
  const journal = [
    { id: 'new', status: 'failed', createdAt: '2026-10-03T12:00:00Z' },
    { id: 'ok-2', status: 'healthy', createdAt: '2026-10-02T12:00:00Z' },
    { id: 'bad', status: 'failed', createdAt: '2026-10-01T18:00:00Z' },
    { id: 'ok-1', status: 'healthy', createdAt: '2026-10-01T12:00:00Z' },
  ]
  assert.equal(previousSuccessfulRelease(journal, 'new')?.id, 'ok-2')
  assert.equal(previousSuccessfulRelease(journal, 'bad')?.id, 'ok-1')
  assert.equal(previousSuccessfulRelease(journal, 'ok-1'), undefined)
  assert.equal(previousSuccessfulRelease(journal, 'missing'), undefined)
})
