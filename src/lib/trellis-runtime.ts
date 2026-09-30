import { TrellisApiError } from '@/lib/trellis'
import type { TrellisAllocation } from '@/types/trellis'

/** Safe for presentation: never expose upstream bodies, credentials, or URLs. */
export function trellisReadError(error: unknown): string {
  if (error instanceof TrellisApiError) {
    if (error.status === 403 || error.status === 401) return 'Trellis denied access to this data.'
    if (error.status === 404) return 'This resource is unavailable in Trellis (404).'
    return `Trellis request failed (${error.status}).`
  }
  return 'Unable to read Trellis data. Check the connection and credentials.'
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
