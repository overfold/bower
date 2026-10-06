import assert from 'node:assert/strict'
import test from 'node:test'
import { nextRefreshDelay, refreshFailed, shouldRefresh, REFRESH_FAST_MS, REFRESH_IDLE_MS, REFRESH_MAX_BACKOFF_MS } from './refresh-schedule'

const clear = { hidden: false, offline: false, dialogOpen: false, unsavedChanges: false, editingText: false }

test('refresh is fast during a deployment, modest otherwise, and backs off on trouble up to a cap', () => {
  assert.equal(nextRefreshDelay({ fast: true, failures: 0 }), REFRESH_FAST_MS)
  assert.equal(nextRefreshDelay({ fast: false, failures: 0 }), REFRESH_IDLE_MS)
  assert.equal(nextRefreshDelay({ fast: false, failures: 1 }), REFRESH_IDLE_MS * 2)
  assert.equal(nextRefreshDelay({ fast: false, failures: 10 }), REFRESH_MAX_BACKOFF_MS)
  assert.equal(nextRefreshDelay({ fast: true, failures: 10 }), REFRESH_MAX_BACKOFF_MS)
})

test('refresh never runs in the background, offline, behind a dialog, or over unsaved edits', () => {
  assert.equal(shouldRefresh(clear), true)
  for (const key of Object.keys(clear) as (keyof typeof clear)[]) assert.equal(shouldRefresh({ ...clear, [key]: true }), false, key)
})

test('slow refreshes count as failures', () => {
  assert.equal(refreshFailed(300, false), false)
  assert.equal(refreshFailed(9_000, false), true)
  assert.equal(refreshFailed(10, true), true)
})
