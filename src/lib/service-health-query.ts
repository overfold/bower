import { getServiceSummaries } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { allocationBelongsToService, trellisReadError } from '@/lib/trellis-runtime'
import { getReadyCount, getServiceHealth } from '@/lib/service-health'
import type { TrellisAllocation, TrellisJob } from '@/types/trellis'

export async function getProjectLiveServices(orgId: string, projectId: string, environment: { id: string; trellisNamespace: string } | undefined) {
  const summaries = environment ? await getServiceSummaries(projectId, environment.id) : []
  let allocations: TrellisAllocation[] = []
  let jobs: TrellisJob[] = []
  let error: string | null = null
  if (environment && summaries.some((row) => row.latestDeployment)) {
    try {
      const client = await getTrellisClient(orgId)
      ;[allocations, jobs] = await Promise.all([client.listAllocations({ namespace: environment.trellisNamespace }), client.listJobs(environment.trellisNamespace)])
    } catch (cause) { error = trellisReadError(cause) }
  }
  return { error, jobs, services: summaries.map((row) => {
    const owned = allocations.filter((allocation) => allocationBelongsToService(allocation, environment!.trellisNamespace, row.service.slug, [row.service.slug, row.config?.activeJobName ?? null]))
    return { ...row, allocations: owned, ready: error ? null : getReadyCount(owned), health: error && row.latestDeployment ? 'unknown' : getServiceHealth({ allocations: owned, desiredReplicas: row.config?.replicas ?? 0, deploymentStatus: row.latestDeployment?.status, deployed: Boolean(row.latestDeployment) }) }
  }) }
}
