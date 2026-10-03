import assert from 'node:assert/strict'
import test from 'node:test'
import { deploymentImageTag, formatRatio, formatPercent, formatCpu, formatDate, formatDisplayToken, formatMemory, formatReadyReplicas, formatRelativeTime, formatTimestamp, timestampTitle } from './format'

const NOW = Date.parse('2026-01-02T00:00:00.000Z')

test('relative time uses compact past boundaries and readable future values', () => {
  assert.equal(formatRelativeTime('2026-01-01T23:59:01Z', NOW), 'just now')
  assert.equal(formatRelativeTime('2026-01-01T23:59:00Z', NOW), '1m ago')
  assert.equal(formatRelativeTime('2026-01-01T23:00:00Z', NOW), '1h ago')
  assert.equal(formatRelativeTime('2026-01-01T00:00:00Z', NOW), '1d ago')
  assert.equal(formatRelativeTime('2026-01-03T00:00:00Z', NOW), 'in 1 day')
  assert.equal(formatRelativeTime('2026-01-09T00:00:00Z', NOW), 'in 7 days')
  assert.equal(formatRelativeTime('2026-01-02T00:00:59Z', NOW), 'in 59 seconds')
  assert.equal(formatRelativeTime('2026-01-02T00:01:00Z', NOW), 'in 1 minute')
  assert.equal(formatRelativeTime('2026-01-02T01:00:00Z', NOW), 'in 1 hour')
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
  assert.equal(formatTimestamp(value, 'UTC'), 'Jan 2, 2026, 04:30 UTC')
})

test('display tokens are consistently humanized', () => {
  assert.equal(formatDisplayToken('auto_rollback'), 'Auto Rollback')
  assert.equal(formatDisplayToken(null), '—')
})

test('resource formatters cap CPU precision and switch memory units at one GiB', () => {
  assert.equal(formatCpu(1), '<0.01 cores')
  assert.equal(formatCpu(999), '1 core')
  assert.equal(formatCpu(1234), '1.23 cores')
  assert.equal(formatCpu(1000), '1 core')
  assert.equal(formatMemory(1024 * 1024 * 1024 - 1), '1024 MB')
  assert.equal(formatMemory(1024 * 1024 * 1024), '1 GB')
})

test('ready replica formatting makes unavailable observations explicit', () => {
  assert.equal(formatReadyReplicas(2, 3), '2/3 ready')
  assert.equal(formatReadyReplicas(null, 3), 'Unavailable · 3 desired')
})

test('ratios, percentages, and image tags have consistent compact formatting', () => {
  assert.equal(formatRatio(2, 10, 'uses'), '2/10 uses')
  assert.equal(formatPercent(66.7), '67%')
  assert.equal(deploymentImageTag('registry.test:5000/acme/storefront:v2.4.1'), 'v2.4.1')
  assert.equal(deploymentImageTag('registry.test:5000/storefront'), 'latest')
  assert.equal(deploymentImageTag('acme/storefront@sha256:abc'), 'sha256:abc')
})

test('timestamps follow viewer timezone across midnight and include UTC in the tooltip', () => {
  const value = '2026-10-02T23:30:00Z'
  assert.match(formatTimestamp(value, 'Europe/Madrid'), /Oct 3, 2026, 01:30/)
  assert.match(timestampTitle(value, 'Europe/Madrid'), /Oct 2, 2026, 23:30 UTC/)
  assert.match(formatTimestamp('2026-01-02T23:30:00Z', 'Europe/Madrid'), /Jan 3, 2026, 00:30/)
})
