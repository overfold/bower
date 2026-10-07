'use server'

import { and, asc, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { allocationMetricSamples, deployments, environments } from '@/db/schema'
import { requireService } from '@/lib/actions/shared'
import { buildMetricsSeries, effectiveBucketSeconds, metricsIntervalSeconds, metricsRetentionHours, metricsWindow, validateMetricsRange, type MetricsBucketRow, type MetricsHistory } from '@/lib/metrics-series'

type SeriesInput = { serviceId: string; environmentId: string; range: string; allocationId?: string }

/**
 * CPU and memory history for one service in one environment, read only from
 * the samples Postgres already holds, plus the deployments that started in the
 * same window. `allocationId` narrows the samples to one allocation; because the
 * filter also requires the service, another service's allocation yields an empty
 * series, and Trellis is never asked, so history outlives the allocation. Any
 * project role may read it, so it is neither role-gated nor audited.
 */
export async function getServiceMetricsSeries({ serviceId, environmentId, range, allocationId }: SeriesInput): Promise<MetricsHistory> {
  if (allocationId !== undefined && typeof allocationId !== 'string') throw new Error('Invalid allocation.')
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
  const samples = db.select({
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
      allocationId === undefined ? undefined : eq(allocationMetricSamples.allocationId, allocationId),
    ))
    .groupBy(bucket, allocationMetricSamples.allocationId)
  const started = db.select({ id: deployments.id, startedAt: deployments.startedAt, status: deployments.status, image: deployments.imageAfter }).from(deployments)
    .where(and(
      eq(deployments.serviceId, serviceId),
      eq(deployments.environmentId, environmentId),
      gte(deployments.startedAt, new Date(window.from)),
      lt(deployments.startedAt, new Date(window.to)),
    ))
    .orderBy(asc(deployments.startedAt))
  const [rows, deploymentRows] = await Promise.all([samples, started])

  const series = buildMetricsSeries(validRange, now, rows.map((row): MetricsBucketRow => ({
    bucketStart: Number(row.bucketStart),
    allocationId: row.allocationId,
    cpuAvg: row.cpuAvg === null ? null : Number(row.cpuAvg),
    cpuMax: row.cpuMax === null ? null : Number(row.cpuMax),
    memoryAvg: row.memoryAvg === null ? null : Number(row.memoryAvg),
    memoryMax: row.memoryMax === null ? null : Number(row.memoryMax),
  })), bucketSeconds)
  return { ...series, deployments: deploymentRows.map((row) => ({ id: row.id, startedAt: row.startedAt.getTime(), status: row.status, image: row.image })) }
}
