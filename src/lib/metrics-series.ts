import { DEFAULT_METRICS_INTERVAL_SECONDS, DEFAULT_METRICS_RETENTION_HOURS, parseMetricsInterval, parseMetricsRetention } from '@/lib/metrics-sampler'

export const METRICS_RANGES = {
  '1h': { hours: 1, bucketSeconds: 15 },
  '6h': { hours: 6, bucketSeconds: 60 },
  '24h': { hours: 24, bucketSeconds: 300 },
} as const

export type MetricsRange = keyof typeof METRICS_RANGES

export const METRICS_RANGE_KEYS = Object.keys(METRICS_RANGES) as MetricsRange[]

/** One allocation's aggregate inside one bucket, as the database returns it. */
export type MetricsBucketRow = {
  bucketStart: number
  allocationId: string
  cpuAvg: number | null
  cpuMax: number | null
  memoryAvg: number | null
  memoryMax: number | null
}

/** A bucket of the series; every metric is null when the bucket has no data (a gap, never a zero). */
export type MetricsSeriesPoint = {
  t: number
  cpu: number | null
  cpuPeak: number | null
  memory: number | null
  memoryPeak: number | null
}

export type MetricsSeries = {
  range: MetricsRange
  bucketSeconds: number
  points: MetricsSeriesPoint[]
}

export function isMetricsRange(value: unknown): value is MetricsRange {
  return typeof value === 'string' && Object.hasOwn(METRICS_RANGES, value)
}

/** Ranges the configured retention can fully serve, shortest first. */
export function availableMetricsRanges(retentionHours: number): MetricsRange[] {
  return METRICS_RANGE_KEYS.filter((range) => METRICS_RANGES[range].hours <= retentionHours)
}

export function metricsRetentionHours(env: Record<string, string | undefined> = process.env): number {
  const retention = parseMetricsRetention(env.BOWER_METRICS_RETENTION_HOURS).value
  return Number.isFinite(retention) ? retention : DEFAULT_METRICS_RETENTION_HOURS
}

/** Throws unless `range` is known and no longer than `retentionHours`. */
export function validateMetricsRange(range: unknown, retentionHours: number): MetricsRange {
  if (!isMetricsRange(range)) throw new Error('Unsupported metrics range.')
  if (METRICS_RANGES[range].hours > retentionHours) throw new Error(`Metrics are retained for ${retentionHours} ${retentionHours === 1 ? 'hour' : 'hours'}; choose a shorter range.`)
  return range
}

/** Sampling cadence in seconds as configured, falling back to the default when sampling is disabled (0). */
export function metricsIntervalSeconds(env: Record<string, string | undefined> = process.env): number {
  const interval = parseMetricsInterval(env.BOWER_METRICS_INTERVAL).value
  return interval > 0 ? interval : DEFAULT_METRICS_INTERVAL_SECONDS
}

/**
 * The range's nominal bucket (15 s, 1 min, 5 min), widened in steps of itself until a bucket spans at least two
 * sampling intervals. A bucket narrower than the cadence would be empty every other time and the line would
 * degrade to isolated dots; two intervals also absorb timer jitter at a bucket edge.
 */
export function effectiveBucketSeconds(range: MetricsRange, intervalSeconds: number): number {
  const { bucketSeconds } = METRICS_RANGES[range]
  const minimum = 2 * intervalSeconds
  return bucketSeconds >= minimum ? bucketSeconds : Math.ceil(minimum / bucketSeconds) * bucketSeconds
}

/** The query window: the buckets covering `range`, the last one containing `now`. Buckets align to the Unix epoch, like `date_bin`. */
export function metricsWindow(range: MetricsRange, now: number, bucketSeconds: number = METRICS_RANGES[range].bucketSeconds) {
  const { hours } = METRICS_RANGES[range]
  const bucketMs = bucketSeconds * 1000
  const lastBucket = Math.floor(now / bucketMs) * bucketMs
  const count = Math.ceil(hours * 3600 / bucketSeconds)
  return { bucketMs, count, from: lastBucket - (count - 1) * bucketMs, to: lastBucket + bucketMs }
}

function sumOrNull(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value))
  return present.length ? present.reduce((total, value) => total + value, 0) : null
}

/**
 * Builds the full series for a window. Each allocation contributes its own
 * average within a bucket and the buckets sum those averages, so an allocation
 * that ran for part of a bucket still counts once. The peak sums each
 * allocation's maximum, which can exceed the true simultaneous peak when the
 * allocations peaked at different moments. Buckets without rows stay null.
 */
export function buildMetricsSeries(range: MetricsRange, now: number, rows: MetricsBucketRow[], bucketSeconds: number = METRICS_RANGES[range].bucketSeconds): MetricsSeries {
  const { bucketMs, count, from } = metricsWindow(range, now, bucketSeconds)
  const byBucket = new Map<number, MetricsBucketRow[]>()
  for (const row of rows) {
    const list = byBucket.get(row.bucketStart)
    if (list) list.push(row)
    else byBucket.set(row.bucketStart, [row])
  }
  const points = Array.from({ length: count }, (_, index): MetricsSeriesPoint => {
    const t = from + index * bucketMs
    const bucket = byBucket.get(t)
    if (!bucket) return { t, cpu: null, cpuPeak: null, memory: null, memoryPeak: null }
    return {
      t,
      cpu: sumOrNull(bucket.map((row) => row.cpuAvg)),
      cpuPeak: sumOrNull(bucket.map((row) => row.cpuMax)),
      memory: sumOrNull(bucket.map((row) => row.memoryAvg)),
      memoryPeak: sumOrNull(bucket.map((row) => row.memoryMax)),
    }
  })
  return { range, bucketSeconds, points }
}
