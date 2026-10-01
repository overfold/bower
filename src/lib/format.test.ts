import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDate, formatDisplayToken, formatRelativeTime, formatTimestamp } from './format'

const NOW = Date.parse('2026-01-02T00:00:00.000Z')

test('relative time uses compact boundaries and clamps future values', () => {
  assert.equal(formatRelativeTime('2026-01-01T23:59:01Z', NOW), 'just now')
  assert.equal(formatRelativeTime('2026-01-01T23:59:00Z', NOW), '1m ago')
  assert.equal(formatRelativeTime('2026-01-01T23:00:00Z', NOW), '1h ago')
  assert.equal(formatRelativeTime('2026-01-01T00:00:00Z', NOW), '1d ago')
  assert.equal(formatRelativeTime('2026-01-03T00:00:00Z', NOW), 'just now')
})

test('date formatters handle unavailable and invalid values', () => {
  for (const value of [null, undefined, 'not-a-date'] as const) {
    assert.equal(formatDate(value), '—')
    assert.equal(formatTimestamp(value), '—')
    assert.equal(formatRelativeTime(value, NOW), '—')
  }
})

test('absolute formats are English UTC across a timezone midnight', () => {
  const value = '2026-01-01T23:30:00-05:00'
  assert.equal(formatDate(value), 'Jan 2, 2026 UTC')
  assert.equal(formatTimestamp(value), 'Jan 2, 2026, 04:30 UTC')
})

test('display tokens are consistently humanized', () => {
  assert.equal(formatDisplayToken('auto_rollback'), 'Auto Rollback')
  assert.equal(formatDisplayToken(null), '—')
})
