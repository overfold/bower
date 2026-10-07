import { cpuMillicores } from '@/lib/cpu-usage'
import { trellisReadError } from '@/lib/trellis-runtime'
import type { TrellisAllocation, TrellisAllocationMetrics } from '@/types/trellis'

declare global {
  var bowerMetricsSampler: NodeJS.Timeout[] | undefined
}

export const DEFAULT_METRICS_INTERVAL_SECONDS = 30
export const MIN_METRICS_INTERVAL_SECONDS = 10
export const MAX_METRICS_INTERVAL_SECONDS = 300
export const DEFAULT_METRICS_RETENTION_HOURS = 24
export const MIN_METRICS_RETENTION_HOURS = 1
export const MAX_METRICS_RETENTION_HOURS = 168
export const METRICS_FETCH_CONCURRENCY = 8
export const METRICS_PRUNE_INTERVAL_MS = 10 * 60 * 1000
export const METRICS_PRUNE_BATCH_SIZE = 10_000
const METRICS_TIMEOUT_CAP_MS = 15_000

type Setting = { value: number; warning?: string }

function parseSetting(name: string, raw: string | undefined, fallback: number, min: number, max: number, allowZero: boolean): Setting {
  if (raw === undefined || raw.trim() === '') return { value: fallback }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return { value: fallback, warning: `${name}=${JSON.stringify(raw)} is not a number; using ${fallback}.` }
  if (allowZero && parsed === 0) return { value: 0 }
  const value = Math.min(max, Math.max(min, parsed))
  return value === parsed ? { value } : { value, warning: `${name}=${raw} is outside ${min}-${max}; using ${value}.` }
}

/** Sampling cadence in seconds: 0 disables sampling, anything else is clamped to 10-300. */
export function parseMetricsInterval(raw: string | undefined): Setting {
  return parseSetting('BOWER_METRICS_INTERVAL', raw, DEFAULT_METRICS_INTERVAL_SECONDS, MIN_METRICS_INTERVAL_SECONDS, MAX_METRICS_INTERVAL_SECONDS, true)
}

/** How long samples are kept, in hours, clamped to 1-168. */
export function parseMetricsRetention(raw: string | undefined): Setting {
  return parseSetting('BOWER_METRICS_RETENTION_HOURS', raw, DEFAULT_METRICS_RETENTION_HOURS, MIN_METRICS_RETENTION_HOURS, MAX_METRICS_RETENTION_HOURS, false)
}

export type MetricSampleRow = {
  serviceId: string
  environmentId: string
  allocationId: string
  nodeId: string
  collectedAt: Date
  cpuMillicores: number | null
  memoryBytes: number
  taskCount: number
}

type ServiceTarget = { serviceId: string; environmentId: string }
type MetricsClient = {
  listAllocations(filters?: { label?: string }): Promise<TrellisAllocation[]>
  getAllocationMetrics(id: string, namespace: string): Promise<TrellisAllocationMetrics[]>
}

export interface MetricsSamplerDeps {
  /** Organizations with Trellis configured. */
  listOrgs(): Promise<Array<{ id: string }>>
  getClient(orgId: string): Promise<MetricsClient>
  /** `${namespace}/${service slug}` for the organization's services, so one allocation maps to one service. */
  loadServiceTargets(orgId: string): Promise<Map<string, ServiceTarget>>
  insertSamples(rows: MetricSampleRow[]): Promise<void>
  timeoutMs: number
  concurrency?: number
  log?: (message: string, detail?: unknown) => void
}

export const serviceTargetKey = (namespace: string, service: string) => `${namespace}/${service}`

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Trellis metrics read timed out')), ms) })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

/** Runs `work` over `items` with at most `limit` in flight; `work` must not throw. */
async function forEachLimited<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await work(items[next++])
  }))
}

/**
 * Builds the sampler tick. Allocations are stored once each with their tasks summed. A failed read
 * writes nothing, so a gap is a gap rather than a zero, and keeps the earlier reading so CPU is not
 * mis-measured against a stale baseline once reads resume.
 */
export function createMetricsSampler(deps: MetricsSamplerDeps) {
  const log = deps.log ?? ((message, detail) => console.error(message, detail))
  const concurrency = deps.concurrency ?? METRICS_FETCH_CONCURRENCY
  const previous = new Map<string, TrellisAllocationMetrics[]>()
  let running = false

  async function sampleOrg(orgId: string) {
    const client = await deps.getClient(orgId)
    const listed = await withTimeout(client.listAllocations({ label: 'bower/managed=true' }), deps.timeoutMs)
    const targets = await deps.loadServiceTargets(orgId)
    const live = listed.filter((allocation) => allocation.phase === 'running' && allocation.labels?.['bower/managed'] === 'true')
    const mapped = live.flatMap((allocation) => {
      const service = allocation.labels['bower/service']
      const target = service ? targets.get(serviceTargetKey(allocation.namespace, service)) : undefined
      return target ? [{ allocation, target }] : []
    })

    const rows: MetricSampleRow[] = []
    await forEachLimited(mapped, concurrency, async ({ allocation, target }) => {
      try {
        const metrics = await withTimeout(client.getAllocationMetrics(allocation.id, allocation.namespace), deps.timeoutMs)
        const collectedAt = new Date(Math.max(...metrics.map((item) => Date.parse(item.collected_at))))
        if (!metrics.length || Number.isNaN(collectedAt.getTime())) return
        const before = previous.get(allocation.id)
        previous.set(allocation.id, metrics)
        rows.push({
          ...target,
          allocationId: allocation.id,
          nodeId: allocation.node_id,
          collectedAt,
          cpuMillicores: before ? cpuMillicores(before, metrics) : null,
          memoryBytes: metrics.reduce((sum, item) => sum + item.memory_usage_bytes, 0),
          taskCount: metrics.length,
        })
      } catch (error) {
        log('Bower metrics sample failed:', { orgId, allocationId: allocation.id, message: trellisReadError(error) })
      }
    })

    if (rows.length) await deps.insertSamples(rows)
    return new Set(mapped.map(({ allocation }) => allocation.id))
  }

  return {
    /** One sampling pass. A pass that starts while another is still running is skipped. */
    async tick() {
      if (running) return
      running = true
      try {
        const alive = new Set<string>()
        let complete = true
        for (const org of await deps.listOrgs()) {
          try {
            for (const id of await sampleOrg(org.id)) alive.add(id)
          } catch (error) {
            complete = false
            log('Bower metrics sampling failed:', { orgId: org.id, message: trellisReadError(error) })
          }
        }
        // Forget allocations that are gone. Only a pass that read every organization can tell which have.
        if (complete) for (const id of previous.keys()) if (!alive.has(id)) previous.delete(id)
      } catch (error) {
        log('Bower metrics sampling failed:', trellisReadError(error))
      } finally {
        running = false
      }
    },
    /** Allocation ids with a remembered previous reading. */
    tracked: () => [...previous.keys()],
  }
}

export interface MetricsPrunerDeps {
  /** Deletes up to `limit` samples collected before `cutoff` and returns how many were removed. */
  deleteBatch(cutoff: Date, limit: number): Promise<number>
  now(): number
  retentionHours: number
  batchSize?: number
}

/** Deletes samples older than the retention window in bounded batches. Returns the number deleted. */
export async function pruneMetricSamples({ deleteBatch, now, retentionHours, batchSize = METRICS_PRUNE_BATCH_SIZE }: MetricsPrunerDeps) {
  const cutoff = new Date(now() - retentionHours * 3_600_000)
  let total = 0
  for (;;) {
    const deleted = await deleteBatch(cutoff, batchSize)
    total += deleted
    if (deleted < batchSize) return total
  }
}

/** Starts the sampling and pruning timers once per process. Follows the one-active-process contract. */
export async function startMetricsSampler(env: Record<string, string | undefined> = process.env) {
  if (globalThis.bowerMetricsSampler) return
  const interval = parseMetricsInterval(env.BOWER_METRICS_INTERVAL)
  const retention = parseMetricsRetention(env.BOWER_METRICS_RETENTION_HOURS)
  for (const setting of [interval, retention]) if (setting.warning) console.warn(`Bower: ${setting.warning}`)

  const [{ db }, schema, { eq, lt, sql }, { getTrellisClient }, { hasTrellisConnection }] = await Promise.all([
    import('@/db'), import('@/db/schema'), import('drizzle-orm'), import('@/lib/trellis-instance'), import('@/lib/trellis-connection'),
  ])
  const { allocationMetricSamples, environments, organizations, projects, services } = schema
  const timers: NodeJS.Timeout[] = []
  globalThis.bowerMetricsSampler = timers

  const pruning = { running: false }
  const prune = async () => {
    if (pruning.running) return
    pruning.running = true
    try {
      await pruneMetricSamples({
        now: Date.now,
        retentionHours: retention.value,
        deleteBatch: async (cutoff, limit) => {
          const result = await db.execute(sql`
            WITH doomed AS (
              SELECT allocation_id, collected_at FROM ${allocationMetricSamples} WHERE ${lt(allocationMetricSamples.collectedAt, cutoff)} LIMIT ${limit}
            )
            DELETE FROM ${allocationMetricSamples} AS samples USING doomed
            WHERE samples.allocation_id = doomed.allocation_id AND samples.collected_at = doomed.collected_at`)
          return result.count
        },
      })
    } catch (error) { console.error('Bower metrics pruning failed:', error instanceof Error ? error.message : 'unknown error') }
    finally { pruning.running = false }
  }
  prune()
  timers.push(setInterval(prune, METRICS_PRUNE_INTERVAL_MS))

  if (interval.value > 0) {
    const sampler = createMetricsSampler({
      timeoutMs: Math.min(METRICS_TIMEOUT_CAP_MS, interval.value * 800),
      listOrgs: async () => (await db.select().from(organizations)).filter((org) => hasTrellisConnection(org)),
      getClient: (orgId) => getTrellisClient(orgId),
      loadServiceTargets: async (orgId) => {
        const rows = await db
          .select({ namespace: environments.trellisNamespace, slug: services.slug, serviceId: services.id, environmentId: environments.id })
          .from(environments)
          .innerJoin(projects, eq(projects.id, environments.projectId))
          .innerJoin(services, eq(services.projectId, projects.id))
          .where(eq(projects.orgId, orgId))
        const targets = new Map<string, ServiceTarget>()
        const ambiguous = new Set<string>()
        for (const row of rows) {
          const key = serviceTargetKey(row.namespace, row.slug)
          if (targets.has(key)) ambiguous.add(key)
          targets.set(key, { serviceId: row.serviceId, environmentId: row.environmentId })
        }
        // A namespace shared by two environments cannot say which one owns an allocation.
        for (const key of ambiguous) targets.delete(key)
        return targets
      },
      insertSamples: async (rows) => { await db.insert(allocationMetricSamples).values(rows).onConflictDoNothing() },
    })
    sampler.tick()
    timers.push(setInterval(sampler.tick, interval.value * 1000))
  }
  for (const timer of timers) timer.unref()
}
