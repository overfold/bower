import type { TrellisAllocation, TrellisJob, TrellisNode } from '@/types/trellis'

type DeploymentRow = { deployment: { id: string; serviceId: string; status: string; createdAt: Date }; serviceName: string; projectSlug: string }
type Target = { namespace: string; job: string | null; serviceSlug: string; serviceName: string; projectSlug: string }
export type AttentionRow = { id: string; status: string; serviceName: string; specificId?: string; cause: string; since?: Date | string; href: string; action: string }

/** Select latest first, then filter failures: a later release supersedes a failure. */
export function latestFailedDeployments<T extends DeploymentRow>(rows: T[], now: number): T[] {
  const latest = new Map<string, T>()
  for (const row of rows) {
    const previous = latest.get(row.deployment.serviceId)
    if (!previous || row.deployment.createdAt > previous.deployment.createdAt) latest.set(row.deployment.serviceId, row)
  }
  return [...latest.values()].filter(({ deployment }) => deployment.status === 'failed' && deployment.createdAt.getTime() <= now && now - deployment.createdAt.getTime() <= 86_400_000)
}

export function needsAttentionRows({ deployments, allocations, jobs, targets, nodes = [], now }: { deployments: DeploymentRow[]; allocations: TrellisAllocation[]; jobs: TrellisJob[]; targets: Target[]; nodes?: TrellisNode[]; now: number }): AttentionRow[] {
  const rows: AttentionRow[] = latestFailedDeployments(deployments, now).map(({ deployment, serviceName, projectSlug }) => ({ id: `deployment-${deployment.id}`, status: 'failed', serviceName, cause: 'Deployment failed', since: deployment.createdAt, href: `/projects/${projectSlug}/deployments/${deployment.id}`, action: 'View diagnostics' }))
  const targetFor = (namespace: string, job: string) => targets.find((target) => target.namespace === namespace && (target.job === job || target.serviceSlug === job))
  for (const allocation of allocations.filter((allocation) => allocation.health === 'unhealthy' || ['failed', 'lost'].includes(allocation.phase))) {
    const target = targetFor(allocation.namespace, allocation.job)
    if (!target) continue
    rows.push({ id: `allocation-${allocation.id}`, status: 'failing', serviceName: target.serviceName, specificId: allocation.id, cause: allocation.message || allocation.reason || 'Health checks are failing', since: allocation.last_transition_at, href: `/projects/${target.projectSlug}/services/${target.serviceSlug}/allocations/${encodeURIComponent(allocation.id)}`, action: 'View logs' })
  }
  for (const node of nodes.filter((node) => node.status === 'draining' && allocations.some((allocation) => allocation.node_id === node.id && !['stopped', 'failed', 'lost', 'completed', 'dead'].includes(allocation.phase)))) rows.push({ id: `node-${node.id}`, status: 'draining', serviceName: node.id, cause: 'Allocations are being moved', href: `/status/${encodeURIComponent(node.id)}`, action: 'View progress' })
  for (const job of jobs) for (const backoff of job.replacement_backoff ?? []) {
    const target = targetFor(job.spec?.namespace ?? '', job.name)
    if (!target) continue
    rows.push({ id: `backoff-${job.spec?.namespace}-${job.name}-${backoff.group}`, status: 'failing', serviceName: target.serviceName, specificId: job.name, cause: backoff.message || backoff.reason || 'Restart pending', since: backoff.last_failure_at, href: `/projects/${target.projectSlug}/services/${target.serviceSlug}`, action: 'Review restart' })
  }
  return rows
}
