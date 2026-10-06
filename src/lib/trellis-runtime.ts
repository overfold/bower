import { TrellisApiError } from '@/lib/trellis'
import type { TrellisAllocation, TrellisNode } from '@/types/trellis'

const STALE_OBSERVATION_MS = 60_000

/** Safe for presentation: never expose upstream bodies, credentials, or URLs. */
export function trellisReadError(error: unknown): string {
  if (error instanceof TrellisApiError) {
    if (error.status === 403 || error.status === 401) return 'Trellis denied access to this data.'
    if (error.status === 404) return 'This resource is unavailable in Trellis (404).'
    return `Trellis request failed (${error.status}).`
  }
  return 'Unable to read Trellis data. Check the connection and credentials.'
}

const MAX_UPSTREAM_MESSAGE = 200
/** Client errors where Trellis's own explanation is about the request, not about the cluster. */
const EXPLAINED_STATUSES = new Set([400, 404, 405, 409, 410, 422, 429])
// Anything that could carry a credential, address, or path to infrastructure disqualifies the whole message.
const UNSAFE_UPSTREAM_TEXT = /https?:\/\/|\bwss?:\/\/|\bbearer\b|\b(?:token|secret|password|passwd|api[_-]?key|authorization)\b\s*[:=]|[A-Za-z0-9+/_-]{32,}={0,2}|\b\d{1,3}(?:\.\d{1,3}){3}\b|-----BEGIN/i

/** A short, plain-text reason from Trellis's JSON `error` field, or null when it is missing or not safe to show. */
export function safeUpstreamMessage(error: TrellisApiError): string | null {
  if (!EXPLAINED_STATUSES.has(error.status)) return null
  const raw = error.json?.error
  if (typeof raw !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text || UNSAFE_UPSTREAM_TEXT.test(text)) return null
  return text.length > MAX_UPSTREAM_MESSAGE ? `${text.slice(0, MAX_UPSTREAM_MESSAGE - 1).trimEnd()}…` : text
}

/**
 * Safe for presentation after Trellis rejects a write. Credentials problems stay generic. For client
 * errors it adds Trellis's own short explanation when that passes `safeUpstreamMessage`; arbitrary
 * bodies, URLs, and secret-looking text are never shown.
 */
export function trellisWriteError(error: TrellisApiError): string {
  if (error.status === 403 || error.status === 401) return 'Trellis denied this request. Check the cluster credentials.'
  const reason = safeUpstreamMessage(error)
  return reason ? `Trellis rejected the request (${error.status}): ${reason}` : `Trellis rejected the request (${error.status}).`
}

export function allocationBelongsToService(allocation: TrellisAllocation, namespace: string, service: string, jobs: Array<string | null>) {
  return allocation.namespace === namespace
    && (allocation.labels?.['bower/service'] === service || jobs.includes(allocation.job))
}

/** Admission is not readiness. Both Caddy and route-sync must be observed healthy. */
export function observedProxyStatus(allocations: TrellisAllocation[], namespace: string, job: string): 'running' | 'pending' | 'unhealthy' {
  const owned = allocations.filter((allocation) => allocation.namespace === namespace && allocation.job === job)
  const current = owned.filter((allocation) => !['stopped', 'stopping', 'failed', 'lost'].includes(allocation.phase))
  if (current.some((allocation) => allocation.health === 'unhealthy')) return 'unhealthy'
  if (!current.length && owned.some((allocation) => ['failed', 'lost'].includes(allocation.phase))) return 'unhealthy'
  return current.length > 0 && current.every((allocation) => allocation.phase === 'running' && allocation.health === 'healthy')
    ? 'running' : 'pending'
}

export type ObservationFreshness = 'fresh' | 'stale' | 'unknown'

export function observationFreshness(value: string | undefined, now = Date.now()): ObservationFreshness {
  if (!value) return 'unknown'
  const at = Date.parse(value)
  if (!Number.isFinite(at)) return 'unknown'
  return now - at > STALE_OBSERVATION_MS ? 'stale' : 'fresh'
}

export function nodeAllocatable(node: TrellisNode) {
  return {
    cpu: node.cpu_allocatable ?? node.cpu,
    memory: node.memory_allocatable ?? node.memory,
  }
}

export function nodeCapacity(node: TrellisNode) {
  return {
    cpu: node.cpu_capacity ?? node.cpu,
    memory: node.memory_capacity ?? node.memory,
  }
}

export interface ManagedProxyObservation {
  status: 'running' | 'pending' | 'unhealthy'
  convergence: 'converged' | 'updating' | 'unknown'
  diagnostic?: string
  failureKind?: 'listener' | 'route-sync' | 'health'
}

/** Submitted state is separate from observed convergence to the target hash. */
export function managedProxyObservation(
  allocations: TrellisAllocation[],
  namespace: string,
  job: string,
  targetHash: string | null,
): ManagedProxyObservation {
  const owned = allocations.filter((allocation) => allocation.namespace === namespace && allocation.job === job)
  const active = owned.filter((allocation) => !['stopped', 'stopping', 'failed', 'lost'].includes(allocation.phase))
  const hashObserved = active.some((allocation) => allocation.labels?.['bower/config-hash'])
  const target = targetHash && hashObserved
    ? active.filter((allocation) => allocation.labels?.['bower/config-hash'] === targetHash)
    : active
  const candidate = target.find((allocation) => allocation.health === 'unhealthy')
    ?? owned.find((allocation) => ['failed', 'lost'].includes(allocation.phase))
  const diagnostic = candidate?.message || candidate?.reason

  if (candidate && (target.includes(candidate) || target.length === 0)) {
    const text = `${candidate.reason ?? ''} ${candidate.message ?? ''}`.toLowerCase()
    const failureKind = /route[- ]?sync|discover|caddy.*config|reconcil/.test(text)
      ? 'route-sync' as const
      : /listen|bind|port|tcp/.test(text)
        ? 'listener' as const
        : 'health' as const
    return { status: 'unhealthy', convergence: targetHash && hashObserved ? 'updating' : 'unknown', diagnostic, failureKind }
  }

  const ready = target.length > 0 && target.every((allocation) => allocation.phase === 'running' && allocation.health === 'healthy')
  if (ready) return { status: 'running', convergence: targetHash && hashObserved ? 'converged' : 'unknown' }
  return {
    status: 'pending',
    convergence: targetHash && hashObserved ? 'updating' : 'unknown',
    diagnostic: target.length === 0 && active.length > 0 ? 'Previous proxy revision is still serving while the target converges.' : diagnostic,
  }
}

export function pendingReasonCounts(allocations: TrellisAllocation[]) {
  const counts = new Map<string, number>()
  for (const allocation of allocations) {
    if (allocation.phase !== 'pending') continue
    const reason = allocation.reason || 'awaiting_placement'
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}
