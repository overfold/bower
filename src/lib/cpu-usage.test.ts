import assert from 'node:assert/strict'
import test from 'node:test'
import { cpuMillicores } from './cpu-usage'
import type { TrellisAllocationMetrics } from '@/types/trellis'

const sample = (cpu: number, at: string, task = 'app'): TrellisAllocationMetrics => ({ allocation_id: 'a', task, cpu_usage_nanoseconds: cpu, memory_usage_bytes: 1, collected_at: at })

test('CPU needs two samples with advancing collection times', () => {
  const first = [sample(1_000_000_000, '2026-10-01T10:00:00Z')]
  assert.equal(cpuMillicores([], first), null)
  // 0.5s of CPU over 5s is 100 millicores.
  assert.equal(Math.round(cpuMillicores(first, [sample(1_500_000_000, '2026-10-01T10:00:05Z')])!), 100)
  // The same collected_at (an unchanged sample) can never produce a reading.
  assert.equal(cpuMillicores(first, [sample(2_000_000_000, '2026-10-01T10:00:00Z')]), null)
})

test('a counter reset on a restarted task is read as usage since the reset, not dropped', () => {
  const before = [sample(9_000_000_000, '2026-10-01T10:00:00Z')]
  const after = [sample(250_000_000, '2026-10-01T10:00:05Z')]
  assert.equal(Math.round(cpuMillicores(before, after)!), 50)
})

test('tasks are summed and unmatched tasks are ignored', () => {
  const before = [sample(0, '2026-10-01T10:00:00Z', 'app'), sample(0, '2026-10-01T10:00:00Z', 'sidecar')]
  const after = [sample(500_000_000, '2026-10-01T10:00:05Z', 'app'), sample(500_000_000, '2026-10-01T10:00:05Z', 'sidecar'), sample(9, '2026-10-01T10:00:05Z', 'new')]
  assert.equal(Math.round(cpuMillicores(before, after)!), 200)
})
