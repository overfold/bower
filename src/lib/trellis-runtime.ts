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

/** Safe for presentation after Trellis rejects a write: never the upstream body. */
export function trellisWriteError(error: TrellisApiError): string {
  if (error.status === 403 || error.status === 401) return 'Trellis denied this request. Check the cluster credentials.'
  return `Trellis rejected the request (${error.status}).`
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
