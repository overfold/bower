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
