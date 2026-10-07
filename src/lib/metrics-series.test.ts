import assert from 'node:assert/strict'
import test from 'node:test'
import { availableMetricsRanges, buildMetricsSeries, effectiveBucketSeconds, metricsIntervalSeconds, metricsRetentionHours, metricsWindow, validateMetricsRange, METRICS_RANGES, METRICS_RANGE_KEYS, type MetricsBucketRow } from './metrics-series'

const NOW = Date.UTC(2026, 9, 7, 12, 3, 40)
const row = (bucketStart: number, allocationId: string, cpuAvg: number | null, memoryAvg: number | null, extra: Partial<MetricsBucketRow> = {}): MetricsBucketRow =>
  ({ bucketStart, allocationId, cpuAvg, cpuMax: cpuAvg, memoryAvg, memoryMax: memoryAvg, ...extra })

test('each range uses its bucket size and yields a fixed number of epoch-aligned buckets ending at the current one', () => {
  for (const [range, bucketSeconds, count] of [['1h', 15, 240], ['6h', 60, 360], ['24h', 300, 288]] as const) {
    assert.equal(METRICS_RANGES[range].bucketSeconds, bucketSeconds)
    const window = metricsWindow(range, NOW)
    assert.equal(window.count, count)
    assert.equal(window.from % (bucketSeconds * 1000), 0)
    assert.ok(window.to > NOW && window.to - NOW <= bucketSeconds * 1000)
    const { points } = buildMetricsSeries(range, NOW, [])
    assert.equal(points.length, count)
    assert.equal(points[0].t, window.from)
    assert.equal(points.at(-1)!.t, window.to - bucketSeconds * 1000)
    assert.ok(points.every((point, index) => index === 0 || point.t - points[index - 1].t === bucketSeconds * 1000))
  }
})

test('buckets without samples are explicit nulls, never zeros', () => {
  const { points } = buildMetricsSeries('1h', NOW, [])
  assert.ok(points.every((point) => point.cpu === null && point.cpuPeak === null && point.memory === null && point.memoryPeak === null))
  const target = points[10].t
  const series = buildMetricsSeries('1h', NOW, [row(target, 'a', 0, 0)])
  assert.equal(series.points[10].cpu, 0)
  assert.equal(series.points[10].memory, 0)
  assert.equal(series.points[9].cpu, null)
  assert.equal(series.points[11].memory, null)
})

test('a bucket sums each allocation average, so an allocation present for part of it counts once', () => {
  const t = buildMetricsSeries('6h', NOW, []).points[100].t
  const { points } = buildMetricsSeries('6h', NOW, [
    row(t, 'a', 200, 100, { cpuMax: 300, memoryMax: 150 }),
    row(t, 'b', 50, 400, { cpuMax: 90, memoryMax: 500 }),
  ])
  assert.deepEqual(points[100], { t, cpu: 250, cpuPeak: 390, memory: 500, memoryPeak: 650 })
})

test('a null CPU average (first sample) contributes nothing but memory still counts; all-null CPU stays null', () => {
  const t = buildMetricsSeries('1h', NOW, []).points[5].t
  const mixed = buildMetricsSeries('1h', NOW, [row(t, 'a', null, 100), row(t, 'b', 40, 200)]).points[5]
  assert.equal(mixed.cpu, 40)
  assert.equal(mixed.memory, 300)
  const onlyFirst = buildMetricsSeries('1h', NOW, [row(t, 'a', null, 100)]).points[5]
  assert.equal(onlyFirst.cpu, null)
  assert.equal(onlyFirst.cpuPeak, null)
  assert.equal(onlyFirst.memory, 100)
})

test('rows outside the window are ignored', () => {
  const { from } = metricsWindow('1h', NOW)
  const { points } = buildMetricsSeries('1h', NOW, [row(from - 15_000, 'a', 1, 1), row(from + 7_000, 'a', 1, 1)])
  assert.ok(points.every((point) => point.cpu === null))
})

test('ranges longer than retention are rejected and hidden', () => {
  assert.deepEqual(availableMetricsRanges(1), ['1h'])
  assert.deepEqual(availableMetricsRanges(6), ['1h', '6h'])
  assert.deepEqual(availableMetricsRanges(24), ['1h', '6h', '24h'])
  assert.deepEqual(availableMetricsRanges(168), ['1h', '6h', '24h'])
  assert.equal(validateMetricsRange('24h', 24), '24h')
  assert.throws(() => validateMetricsRange('24h', 6), /retained for 6 hours/)
  assert.throws(() => validateMetricsRange('6h', 1), /retained for 1 hour;/)
  for (const bad of ['7d', '', 'constructor', undefined, 60]) assert.throws(() => validateMetricsRange(bad, 168), /Unsupported metrics range/)
})

test('retention follows the sampler setting, including its clamping and default', () => {
  assert.equal(metricsRetentionHours({}), 24)
  assert.equal(metricsRetentionHours({ BOWER_METRICS_RETENTION_HOURS: '6' }), 6)
  assert.equal(metricsRetentionHours({ BOWER_METRICS_RETENTION_HOURS: '9999' }), 168)
  assert.equal(metricsRetentionHours({ BOWER_METRICS_RETENTION_HOURS: 'abc' }), 24)
})

test('buckets are widened to at least two sampling intervals so the line never degrades to dots', () => {
  // Defaults: 30 s cadence. A 15 s bucket would be empty every other time, so 1h uses 1 min.
  assert.deepEqual(METRICS_RANGE_KEYS.map((range) => effectiveBucketSeconds(range, 30)), [60, 60, 300])
  assert.deepEqual(METRICS_RANGE_KEYS.map((range) => effectiveBucketSeconds(range, 10)), [30, 60, 300])
  assert.deepEqual(METRICS_RANGE_KEYS.map((range) => effectiveBucketSeconds(range, 300)), [600, 600, 600])
  assert.equal(effectiveBucketSeconds('1h', 15), 30)
  assert.equal(effectiveBucketSeconds('24h', 120), 300)
  // Disabled sampling still yields a usable bucket size.
  assert.equal(metricsIntervalSeconds({ BOWER_METRICS_INTERVAL: '0' }), 30)
  assert.equal(metricsIntervalSeconds({}), 30)
  assert.equal(metricsIntervalSeconds({ BOWER_METRICS_INTERVAL: '60' }), 60)
  // The window covers the whole range with the widened buckets.
  const window = metricsWindow('1h', NOW, 60)
  assert.equal(window.count, 60)
  assert.equal(buildMetricsSeries('1h', NOW, [], 60).points.length, 60)
  assert.equal(buildMetricsSeries('1h', NOW, [], 60).bucketSeconds, 60)
  assert.equal(metricsWindow('1h', NOW, 600).count, 6)
  assert.equal(metricsWindow('1h', NOW, 70).count, 52)
  assert.ok(metricsWindow('1h', NOW, 70).count * 70 >= 3600)
})
