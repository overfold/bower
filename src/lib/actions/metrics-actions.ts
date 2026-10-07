'use server'

import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { allocationMetricSamples, environments } from '@/db/schema'
import { requireService } from '@/lib/actions/shared'
import { buildMetricsSeries, effectiveBucketSeconds, metricsIntervalSeconds, metricsRetentionHours, metricsWindow, validateMetricsRange, type MetricsBucketRow, type MetricsSeries } from '@/lib/metrics-series'

type SeriesInput = { serviceId: string; environmentId: string; range: string }

/**
 * CPU and memory history for one service in one environment, read only from
 * the samples Postgres already holds. Any project role may read it, so it is
 * neither role-gated nor audited.
 */
export async function getServiceMetricsSeries({ serviceId, environmentId, range }: SeriesInput): Promise<MetricsSeries> {
  const access = await requireService(serviceId)
  const [environment] = await db.select({ id: environments.id }).from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, access.service.projectId))).limit(1)
  if (!environment) throw new Error('Environment not found.')
  const validRange = validateMetricsRange(range, metricsRetentionHours())

  const now = Date.now()
  const bucketSeconds = effectiveBucketSeconds(validRange, metricsIntervalSeconds())
  const window = metricsWindow(validRange, now, bucketSeconds)
  // The stride is computed from the constant range table and the configured cadence, never from input, so it is inlined: a bound parameter would
  // make the SELECT and GROUP BY expressions differ and Postgres would reject the grouping.
  const bucket = sql`date_bin(${sql.raw(`interval '${bucketSeconds} seconds'`)}, ${allocationMetricSamples.collectedAt}, timestamptz '1970-01-01 00:00:00+00')`
  const rows = await db.select({
    bucketStart: sql<number>`extract(epoch from ${bucket})::float8 * 1000`,
    allocationId: allocationMetricSamples.allocationId,
    cpuAvg: sql<number | null>`avg(${allocationMetricSamples.cpuMillicores})::float8`,
    cpuMax: sql<number | null>`max(${allocationMetricSamples.cpuMillicores})::float8`,
    memoryAvg: sql<number | null>`avg(${allocationMetricSamples.memoryBytes})::float8`,
    memoryMax: sql<number | null>`max(${allocationMetricSamples.memoryBytes})::float8`,
  }).from(allocationMetricSamples)
    .where(and(
      eq(allocationMetricSamples.serviceId, serviceId),
      eq(allocationMetricSamples.environmentId, environmentId),
      gte(allocationMetricSamples.collectedAt, new Date(window.from)),
      lt(allocationMetricSamples.collectedAt, new Date(window.to)),
    ))
    .groupBy(bucket, allocationMetricSamples.allocationId)

  return buildMetricsSeries(validRange, now, rows.map((row): MetricsBucketRow => ({
    bucketStart: Number(row.bucketStart),
    allocationId: row.allocationId,
    cpuAvg: row.cpuAvg === null ? null : Number(row.cpuAvg),
    cpuMax: row.cpuMax === null ? null : Number(row.cpuMax),
    memoryAvg: row.memoryAvg === null ? null : Number(row.memoryAvg),
    memoryMax: row.memoryMax === null ? null : Number(row.memoryMax),
  })), bucketSeconds)
}
