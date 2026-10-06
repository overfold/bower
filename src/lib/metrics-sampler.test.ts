import assert from 'node:assert/strict'
import test from 'node:test'
import { TrellisApiError } from './trellis'
import {
  createMetricsSampler, parseMetricsInterval, parseMetricsRetention, pruneMetricSamples, serviceTargetKey,
  type MetricSampleRow,
} from './metrics-sampler'
import type { TrellisAllocation, TrellisAllocationMetrics } from '@/types/trellis'

const allocation = (id: string, overrides: Partial<TrellisAllocation> = {}, labels: Record<string, string> = { 'bower/managed': 'true', 'bower/service': 'web' }) =>
  ({ id, namespace: 'demo-production', node_id: 'node-1', phase: 'running', labels, ...overrides }) as TrellisAllocation
const reading = (id: string, cpu: number, at: string, task = 'app', memory = 100): TrellisAllocationMetrics =>
  ({ allocation_id: id, task, cpu_usage_nanoseconds: cpu, memory_usage_bytes: memory, collected_at: at })

const target = { serviceId: 'svc', environmentId: 'env' }

function harness(options: { allocations: () => TrellisAllocation[]; metrics: (id: string) => Promise<TrellisAllocationMetrics[]>; orgs?: string[]; targets?: Map<string, typeof target> }) {
  const rows: MetricSampleRow[] = []
  const logs: unknown[] = []
  const sampler = createMetricsSampler({
    timeoutMs: 50,
    listOrgs: async () => (options.orgs ?? ['org']).map((id) => ({ id })),
    getClient: async () => ({ listAllocations: async () => options.allocations(), getAllocationMetrics: (id: string) => options.metrics(id) }),
    loadServiceTargets: async () => options.targets ?? new Map([[serviceTargetKey('demo-production', 'web'), target]]),
    insertSamples: async (batch) => { rows.push(...batch) },
    log: (_message, detail) => logs.push(detail),
  })
  return { sampler, rows, logs }
}

test('maps running managed allocations to their service and sums tasks, skipping unmapped, stopped and unmanaged ones', async () => {
  const { sampler, rows } = harness({
    allocations: () => [
      allocation('a1'),
      allocation('stopped', { phase: 'stopped' }),
      allocation('other-ns', { namespace: 'elsewhere' }),
      allocation('unknown-service', {}, { 'bower/managed': 'true', 'bower/service': 'ghost' }),
      allocation('unmanaged', {}, { 'bower/service': 'web' }),
    ],
    metrics: async (id) => [reading(id, 1, '2026-10-01T10:00:00Z', 'app', 100), reading(id, 1, '2026-10-01T10:00:01Z', 'sidecar', 50)],
  })
  await sampler.tick()
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], { ...target, allocationId: 'a1', nodeId: 'node-1', collectedAt: new Date('2026-10-01T10:00:01Z'), cpuMillicores: null, memoryBytes: 150, taskCount: 2 })
})

test('CPU is null on the first sample and survives a counter reset afterwards', async () => {
  let call = 0
  const series = [
    [reading('a1', 9_000_000_000, '2026-10-01T10:00:00Z')],
    [reading('a1', 9_500_000_000, '2026-10-01T10:00:05Z')],
    // The counter went backwards: the task restarted, so the value is usage since the reset.
    [reading('a1', 250_000_000, '2026-10-01T10:00:10Z')],
  ]
  const { sampler, rows } = harness({ allocations: () => [allocation('a1')], metrics: async () => series[call++] })
  for (let i = 0; i < 3; i++) await sampler.tick()
  assert.deepEqual(rows.map((row) => row.cpuMillicores === null ? null : Math.round(row.cpuMillicores)), [null, 100, 50])
})

test('a failed or timed-out allocation writes no row and does not stop the others', async () => {
  const { sampler, rows, logs } = harness({
    allocations: () => [allocation('bad'), allocation('slow'), allocation('good')],
    metrics: (id) => id === 'bad' ? Promise.reject(new TrellisApiError(500, 'boom', 'http://secret.example')) : id === 'slow' ? new Promise(() => {}) : Promise.resolve([reading(id, 1, '2026-10-01T10:00:00Z')]),
  })
  await sampler.tick()
  assert.deepEqual(rows.map((row) => row.allocationId), ['good'])
  assert.equal(logs.length, 2)
  assert.doesNotMatch(JSON.stringify(logs), /secret\.example/)
})

test('an allocation with no readings writes no row', async () => {
  const { sampler, rows } = harness({ allocations: () => [allocation('a1')], metrics: async () => [] })
  await sampler.tick()
  assert.equal(rows.length, 0)
})

test('at most eight metrics reads are in flight per organization', async () => {
  let inFlight = 0
  let peak = 0
  const { sampler, rows } = harness({
    allocations: () => Array.from({ length: 20 }, (_, i) => allocation(`a${i}`)),
    metrics: async (id) => {
      peak = Math.max(peak, ++inFlight)
      await new Promise((resolve) => setTimeout(resolve, 2))
      inFlight--
      return [reading(id, 1, '2026-10-01T10:00:00Z')]
    },
  })
  await sampler.tick()
  assert.equal(peak, 8)
  assert.equal(rows.length, 20)
})

test('a tick that starts while another is running is skipped', async () => {
  let release!: () => void
  let lists = 0
  const { sampler } = harness({
    allocations: () => { lists++; return [allocation('a1')] },
    metrics: (id) => new Promise((resolve) => { release = () => resolve([reading(id, 1, '2026-10-01T10:00:00Z')]) }),
  })
  const first = sampler.tick()
  await new Promise((resolve) => setTimeout(resolve, 5))
  await sampler.tick()
  assert.equal(lists, 1)
  release()
  await first
})

test('previous readings are dropped for allocations that have gone, but kept across a failed read', async () => {
  let live = [allocation('a1'), allocation('a2')]
  let failing = false
  const { sampler } = harness({
    allocations: () => live,
    metrics: async (id) => { if (failing) throw new Error('down'); return [reading(id, 1, '2026-10-01T10:00:00Z')] },
  })
  await sampler.tick()
  assert.deepEqual(sampler.tracked().sort(), ['a1', 'a2'])
  failing = true
  await sampler.tick()
  assert.deepEqual(sampler.tracked().sort(), ['a1', 'a2'])
  live = [allocation('a1')]
  await sampler.tick()
  assert.deepEqual(sampler.tracked(), ['a1'])
})

test('a failing organization does not stop other organizations from being sampled', async () => {
  const rows: MetricSampleRow[] = []
  const sampler = createMetricsSampler({
    timeoutMs: 50, log: () => {},
    listOrgs: async () => [{ id: 'down' }, { id: 'up' }],
    getClient: async (orgId) => orgId === 'down' ? Promise.reject(new Error('no credentials')) : { listAllocations: async () => [allocation('a1')], getAllocationMetrics: async (id: string) => [reading(id, 1, '2026-10-01T10:00:00Z')] },
    loadServiceTargets: async () => new Map([[serviceTargetKey('demo-production', 'web'), target]]),
    insertSamples: async (batch) => { rows.push(...batch) },
  })
  await sampler.tick()
  assert.equal(rows.length, 1)
})

test('settings default, disable, clamp and warn', () => {
  assert.deepEqual(parseMetricsInterval(undefined), { value: 30 })
  assert.deepEqual(parseMetricsInterval(''), { value: 30 })
  assert.deepEqual(parseMetricsInterval('0'), { value: 0 })
  assert.deepEqual(parseMetricsInterval('60'), { value: 60 })
  assert.equal(parseMetricsInterval('3').value, 10)
  assert.equal(parseMetricsInterval('-5').value, 10)
  assert.equal(parseMetricsInterval('9000').value, 300)
  assert.equal(parseMetricsInterval('soon').value, 30)
  assert.deepEqual(parseMetricsRetention(undefined), { value: 24 })
  assert.deepEqual(parseMetricsRetention('48'), { value: 48 })
  for (const [raw, value] of [['0', 1], ['-3', 1], ['500', 168]] as const) {
    const parsed = parseMetricsRetention(raw)
    assert.equal(parsed.value, value)
    assert.match(parsed.warning!, /BOWER_METRICS_RETENTION_HOURS/)
  }
  assert.equal(parseMetricsRetention('junk').value, 24)
  assert.ok(parseMetricsRetention('junk').warning)
})

test('pruning deletes before the retention cutoff in batches until one comes up short', async () => {
  const now = Date.parse('2026-10-02T12:00:00Z')
  const calls: Array<{ cutoff: Date; limit: number }> = []
  const results = [10_000, 10_000, 37]
  const total = await pruneMetricSamples({
    now: () => now, retentionHours: 24,
    deleteBatch: async (cutoff, limit) => { calls.push({ cutoff, limit }); return results[calls.length - 1] },
  })
  assert.equal(total, 20_037)
  assert.equal(calls.length, 3)
  assert.ok(calls.every((call) => call.limit === 10_000 && call.cutoff.toISOString() === '2026-10-01T12:00:00.000Z'))
  // Nothing to delete: a single probe.
  let probes = 0
  assert.equal(await pruneMetricSamples({ now: () => now, retentionHours: 1, deleteBatch: async () => { probes++; return 0 } }), 0)
  assert.equal(probes, 1)
})
