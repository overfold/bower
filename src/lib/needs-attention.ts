import { serviceFailure, type ServiceFailure } from '@/lib/service-failure'
import { isUnsuccessfulDeployment } from '@/lib/status'
import type { TrellisAllocation, TrellisJob, TrellisNode } from '@/types/trellis'

type DeploymentRow = { deployment: { id: string; serviceId: string; environmentId?: string; status: string; createdAt: Date; completedAt?: Date | null }; serviceName: string; projectSlug: string; /** The failure event's message, as the deployment page shows it. */ failureMessage?: string | null }
type Target = { serviceId?: string; environmentId?: string; namespace: string; job: string | null; serviceSlug: string; serviceName: string; projectSlug: string }
export type AttentionRow = {
  id: string
  status: string
  serviceName: string
  specificId?: string
  cause: string
  /** Secondary facts under the cause: other allocation messages, the latest deployment outcome. */
  details?: string[]
  /** When the problem began (earliest relevant failure), not the latest transition. */
  since?: Date | string
  /** The most recent failure, when it differs from `since`. */
  lastFailureAt?: Date | string
  href: string
  action: string
  secondary?: { href: string; action: string }
  severity: number
}

const severity = { failing: 0, failed: 1, rolled_back: 2, draining: 3 } as const

/** Select latest first, then filter unsuccessful: a later release supersedes a failure or rollback. */
export function latestFailedDeployments<T extends DeploymentRow>(rows: T[], now: number): T[] {
  const latest = new Map<string, T>()
  for (const row of rows) {
    const previous = latest.get(row.deployment.serviceId)
    if (!previous || row.deployment.createdAt > previous.deployment.createdAt) latest.set(row.deployment.serviceId, row)
  }
  return [...latest.values()].filter(({ deployment }) => isUnsuccessfulDeployment(deployment.status) && deployment.createdAt.getTime() <= now && now - deployment.createdAt.getTime() <= 86_400_000)
}

function deploymentCause(status: string, message?: string | null) {
  if (status === 'rolled_back') return `Rolled back automatically${message ? `: ${message}` : ''}`
  return message || 'Deployment failed'
}

/** One row per service: runtime failure, placement problem, and the latest deployment outcome are merged. */
export function needsAttentionRows({ deployments, allocations, jobs, targets, nodes = [], now }: { deployments: DeploymentRow[]; allocations: TrellisAllocation[]; jobs: TrellisJob[]; targets: Target[]; nodes?: TrellisNode[]; now: number }): AttentionRow[] {
  const targetFor = (namespace: string, job: string) => targets.find((target) => target.namespace === namespace && (target.job === job || target.serviceSlug === job))
  type Group = { target: Target; allocations: TrellisAllocation[]; backoffs: NonNullable<TrellisJob['replacement_backoff']>; deployment?: DeploymentRow }
  const groups = new Map<string, Group>()
  const groupFor = (target: Target) => {
    const key = `${target.namespace}/${target.projectSlug}/${target.serviceSlug}`
    let group = groups.get(key)
    if (!group) groups.set(key, group = { target, allocations: [], backoffs: [] })
    return group
  }

  for (const allocation of allocations) {
    const target = targetFor(allocation.namespace, allocation.job)
    if (target) groupFor(target).allocations.push(allocation)
  }
  for (const job of jobs) for (const backoff of job.replacement_backoff ?? []) {
    const target = targetFor(job.spec?.namespace ?? '', job.name)
    if (target) groupFor(target).backoffs.push(backoff)
  }
  for (const row of latestFailedDeployments(deployments, now)) {
    const target = targets.find((candidate) => candidate.serviceId === row.deployment.serviceId && (!candidate.environmentId || !row.deployment.environmentId || candidate.environmentId === row.deployment.environmentId))
      ?? (targets.some((candidate) => candidate.serviceId) ? undefined : targets.find((candidate) => candidate.projectSlug === row.projectSlug && candidate.serviceName === row.serviceName))
    if (target) groupFor(target).deployment = row
  }

  const rows: AttentionRow[] = []
  for (const { target, allocations: owned, backoffs, deployment } of groups.values()) {
    const failure: ServiceFailure | null = serviceFailure({ allocations: owned, backoffs, now })
    const serviceHref = `/projects/${target.projectSlug}/services/${target.serviceSlug}`
    const deploymentHref = deployment ? `/projects/${deployment.projectSlug}/deployments/${deployment.deployment.id}` : undefined
    const deploymentCauseText = deployment ? deploymentCause(deployment.deployment.status, deployment.failureMessage) : undefined
    const deploymentSince = deployment?.deployment.completedAt ?? deployment?.deployment.createdAt
    if (failure) {
      const details = [...failure.details]
      if (failure.failures && failure.failures > 1) details.push(`${failure.failures} failures`)
      if (deploymentCauseText) details.push(`Latest deployment: ${deploymentCauseText}`)
      rows.push({
        id: `service-${target.namespace}-${target.projectSlug}-${target.serviceSlug}`, status: 'failing', serviceName: target.serviceName, specificId: failure.allocationId,
        cause: failure.cause, details: details.length ? details : undefined, since: failure.failingSince,
        lastFailureAt: failure.lastFailureAt && failure.lastFailureAt !== failure.failingSince ? failure.lastFailureAt : undefined,
        href: failure.allocationId ? `${serviceHref}/allocations/${encodeURIComponent(failure.allocationId)}` : serviceHref,
        action: failure.allocationId ? (failure.kind === 'unplaceable' ? 'View allocation' : 'View logs') : 'Open service',
        secondary: deploymentHref ? { href: deploymentHref, action: 'View deployment' } : undefined,
        severity: severity.failing,
      })
    } else if (deployment && deploymentHref) {
      const status = deployment.deployment.status
      rows.push({ id: `deployment-${deployment.deployment.id}`, status, serviceName: target.serviceName, cause: deploymentCauseText!, since: deploymentSince, href: deploymentHref, action: 'View diagnostics', severity: status === 'rolled_back' ? severity.rolled_back : severity.failed })
    }
  }
  for (const node of nodes.filter((node) => node.status === 'draining' && allocations.some((allocation) => allocation.node_id === node.id && !['stopped', 'failed', 'lost', 'completed', 'dead'].includes(allocation.phase)))) rows.push({ id: `node-${node.id}`, status: 'draining', serviceName: node.id, cause: 'Allocations are being moved', href: `/status/${encodeURIComponent(node.id)}`, action: 'View progress', severity: severity.draining })
  const ms = (value: Date | string | undefined) => value ? new Date(value).getTime() : Infinity
  return rows.sort((a, b) => a.severity - b.severity || ms(a.since) - ms(b.since))
}
