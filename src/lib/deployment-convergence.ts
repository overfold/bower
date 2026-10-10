import type { TrellisAllocation, TrellisJob, TrellisJobSpec } from '@/types/trellis'

const ACTIVE_PHASES = new Set(['pending', 'placed', 'starting', 'running'])

export interface DeploymentIdentity {
  incarnation: string
  version: number
  revision: number
}

export function deploymentDeadlineReached(startedAt: Date | string, deadlineSeconds: number, now = Date.now()) {
  return now - new Date(startedAt).getTime() >= deadlineSeconds * 1000
}

export function sameJobIdentity(job: TrellisJob, identity: DeploymentIdentity) {
  return job.incarnation === identity.incarnation
    && job.version === identity.version
    && job.revision === identity.revision
}

export function deploymentConvergence(job: TrellisJob, spec: TrellisJobSpec, identity: DeploymentIdentity) {
  const desiredByGroup = new Map(spec.task_groups.map((group) => [group.name, group.count]))
  const targetActive = job.allocations.filter((allocation) => allocation.namespace === spec.namespace
    && allocation.job === spec.name
    && allocation.job_incarnation === identity.incarnation
    && allocation.job_revision === identity.revision
    && !allocation.draining
    && ACTIVE_PHASES.has(allocation.phase))
  const activeByGroup = new Map<string, TrellisAllocation[]>()
  for (const allocation of targetActive) {
    const entries = activeByGroup.get(allocation.group) ?? []
    entries.push(allocation)
    activeByGroup.set(allocation.group, entries)
  }
  const groups = [...desiredByGroup].map(([name, desired]) => {
    const active = activeByGroup.get(name) ?? []
    const healthy = active.filter((allocation) => allocation.phase === 'running' && allocation.health === 'healthy').length
    return { name, desired, active: active.length, healthy }
  })
  const desired = groups.reduce((total, group) => total + group.desired, 0)
  return {
    converged: sameJobIdentity(job, identity)
      && job.desired === desired
      && job.running === desired
      && job.healthy === desired
      && groups.every((group) => group.active === group.desired && group.healthy === group.desired),
    groups,
    active: targetActive,
  }
}
