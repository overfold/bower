import type { TrellisAllocation } from '@/types/trellis'

type Allocation = Pick<TrellisAllocation, 'phase' | 'health'> & Partial<Pick<TrellisAllocation, 'reason' | 'message' | 'created_at' | 'last_transition_at'>>

/** Deployment statuses during which a service is legitimately converging. */
export const DEPLOYMENT_IN_PROGRESS_STATUSES = ['pending', 'planning', 'deploying', 'rolling_back']
/** A pending allocation without a placement-failure reason is given this long to be placed. */
export const PENDING_GRACE_MS = 60_000

/**
 * An allocation that has not been placed and is unlikely to be soon: Trellis named a reason
 * (for example insufficient_cpu), or it has been pending longer than the grace period.
 */
export function isStuckPending(allocation: Allocation, now = Date.now()): boolean {
  if (allocation.phase !== 'pending') return false
  if (allocation.reason && allocation.reason !== 'awaiting_placement') return true
  const since = Date.parse(allocation.last_transition_at ?? allocation.created_at ?? '')
  return Number.isFinite(since) && now - since > PENDING_GRACE_MS
}

export function getReadyCount(allocations: Allocation[]): number {
  return allocations.filter((allocation) => allocation.phase === 'running' && allocation.health === 'healthy').length
}

export function allocationHealthSummary(allocations: Allocation[]) {
  const current = allocations.filter((a) => ['pending', 'placed', 'starting', 'running', 'stopping', 'failed', 'lost'].includes(a.phase))
  const healthy = getReadyCount(current)
  const failing = current.filter((a) => a.health === 'unhealthy' || a.phase === 'failed' || a.phase === 'lost').length
  return { total: current.length, healthy, failing, transitioning: current.length - healthy - failing, pending: current.filter((a) => a.phase === 'pending').length }
}

export function worstServiceHealth(statuses: string[]) {
  const severity: Record<string, number> = { healthy: 0, never: 1, stopped: 2, deploying: 3, degraded: 4, down: 5, unknown: 6 }
  return statuses.reduce((worst, status) => severity[status] > severity[worst] ? status : worst, statuses[0] ?? 'never')
}

export function getServiceHealth({ allocations, desiredReplicas, deploymentStatus, deployed, now = Date.now() }: {
  allocations: Allocation[]
  desiredReplicas: number
  deploymentStatus?: string | null
  deployed: boolean
  now?: number
}): string {
  if (!deployed) return 'never'
  if (desiredReplicas === 0) return 'stopped'
  const ready = getReadyCount(allocations)
  if (ready >= desiredReplicas) return 'healthy'
  // Only a deployment in progress, or allocations that are actually moving, count as deploying.
  // Allocations stuck waiting for placement are a failure to reach the desired state, not progress.
  if (DEPLOYMENT_IN_PROGRESS_STATUSES.includes(deploymentStatus ?? '')) return 'deploying'
  const stuck = allocations.some((a) => isStuckPending(a, now))
  if (!stuck && allocations.some((a) => ['pending', 'placed', 'starting', 'stopping'].includes(a.phase))) return 'deploying'
  if (ready > 0) return 'degraded'
  return 'down'
}

export function currentJobAllocations<T extends TrellisAllocation>(allocations: T[], jobs: Array<{ name: string; revision: number; spec?: { namespace: string } }>): T[] {
  const revisions = new Map(jobs.map((job) => [`${job.spec?.namespace ?? ''}/${job.name}`, job.revision]))
  return allocations.filter((allocation) => revisions.get(`${allocation.namespace}/${allocation.job}`) === allocation.job_revision)
}
