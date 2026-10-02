import type { TrellisAllocation } from '@/types/trellis'

type Allocation = Pick<TrellisAllocation, 'phase' | 'health'>

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

export function getServiceHealth({ allocations, desiredReplicas, deploymentStatus, deployed }: {
  allocations: Allocation[]
  desiredReplicas: number
  deploymentStatus?: string | null
  deployed: boolean
}): string {
  if (!deployed) return 'never'
  if (desiredReplicas === 0) return 'stopped'
  const ready = getReadyCount(allocations)
  if (ready >= desiredReplicas) return 'healthy'
  if (['pending', 'planning', 'deploying'].includes(deploymentStatus ?? '') || allocations.some((a) => ['pending', 'placed', 'starting', 'stopping'].includes(a.phase))) return 'deploying'
  if (ready > 0) return 'degraded'
  return 'down'
}

export function currentJobAllocations<T extends TrellisAllocation>(allocations: T[], jobs: Array<{ name: string; revision: number; spec?: { namespace: string } }>): T[] {
  const revisions = new Map(jobs.map((job) => [`${job.spec?.namespace ?? ''}/${job.name}`, job.revision]))
  return allocations.filter((allocation) => revisions.get(`${allocation.namespace}/${allocation.job}`) === allocation.job_revision)
}
