import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { deploymentEvents, deployments, environments, projects, serviceConfigs, services } from '@/db/schema'
import { createDeploymentSpec, notifyDeployment, recordDeploymentEvent } from '@/lib/deployment-runtime'
import { getDeploymentsByProject } from '@/lib/queries'
import { syncManagedProxy } from '@/lib/managed-proxy'
import { getTrellisClient } from '@/lib/trellis-instance'
import type { TrellisJobSpec } from '@/types/trellis'
import { deploymentConvergence, deploymentDeadlineReached, sameJobIdentity } from '@/lib/deployment-convergence'
import { TrellisApiError } from '@/lib/trellis'

const ACTIVE_STATUSES = ['pending', 'planning', 'deploying'] as const
let reconciliationRunning = false

async function recordDiagnosticOnce(deploymentId: string, type: string, message: string, details: Record<string, unknown>) {
  const existing = await db.select({ id: deploymentEvents.id }).from(deploymentEvents).where(and(
    eq(deploymentEvents.deploymentId, deploymentId),
    eq(deploymentEvents.type, type),
  )).limit(1)
  if (!existing.length) await recordDeploymentEvent(deploymentId, type, message, details)
}

async function failDeployment(deployment: typeof deployments.$inferSelect, message: string, details: Record<string, unknown> = {}) {
  await db.update(deployments).set({ status: 'failed', completedAt: new Date() }).where(eq(deployments.id, deployment.id))
  await recordDiagnosticOnce(deployment.id, 'failed', message, details)
  await notifyDeployment(await createDeploymentSpec(deployment.serviceId, deployment.environmentId), 'failed', deployment.triggeredByUserId)
}

export async function reconcileProjectDeployments(projectId: string, orgId: string) {
  const active = (await getDeploymentsByProject(projectId, 100)).filter(({ deployment }) => ACTIVE_STATUSES.includes(deployment.status as typeof ACTIVE_STATUSES[number]))
  if (!active.length) return
  const client = await getTrellisClient(orgId)
  for (const item of active) {
    const deployment = item.deployment
    const [env] = await db.select().from(environments).where(eq(environments.id, deployment.environmentId)).limit(1)
    const [config] = await db.select().from(serviceConfigs).where(and(eq(serviceConfigs.serviceId, deployment.serviceId), eq(serviceConfigs.environmentId, deployment.environmentId))).limit(1)
    if (!env || !config) continue
    try {
      const jobName = deployment.trellisJobName || item.serviceSlug
      const elapsed = (Date.now() - new Date(deployment.startedAt).getTime()) / 1000
      const deadlineReached = deploymentDeadlineReached(deployment.startedAt, config.autoRollbackSeconds)
      const spec = deployment.jobSpec as TrellisJobSpec | null
      const identity = deployment.trellisIncarnation && deployment.trellisVersion && deployment.trellisRevision
        ? { incarnation: deployment.trellisIncarnation, version: deployment.trellisVersion, revision: deployment.trellisRevision }
        : null
      if (!spec || !identity) {
        if (deadlineReached) await failDeployment(deployment, 'Deployment was not accepted by Trellis before its deadline.', { elapsedSeconds: elapsed })
        continue
      }

      const job = await client.getJob(jobName, env.trellisNamespace)
      if (!sameJobIdentity(job, identity)) {
        await failDeployment(deployment, 'The Trellis job was changed by another apply; Bower will not overwrite it.', {
          accepted: identity,
          current: { incarnation: job.incarnation, version: job.version, revision: job.revision },
        })
        continue
      }
      const convergence = deploymentConvergence(job, spec, identity)
      const blocked = convergence.active.filter((allocation) => allocation.phase === 'pending')
      if (blocked.length) {
        await recordDiagnosticOnce(deployment.id, 'scheduling_blocked', 'Trellis could not schedule the new allocation.', {
          allocations: blocked.map(({ id, reason, message, phase }) => ({ id, reason, message, phase })),
        })
      }
      if (job.replacement_backoff?.length) {
        await recordDiagnosticOnce(deployment.id, 'replacement_backoff', 'Trellis is delaying replacement allocations after repeated failures.', {
          groups: job.replacement_backoff,
        })
      }
      if (!convergence.converged) {
        if (!deadlineReached) continue
        if (deployment.previousJobSpec) {
          const previous = deployment.previousJobSpec as TrellisJobSpec
          const previousImage = previous.task_groups[0]?.tasks[0]?.image
          const plan = await client.planJob(previous, previous.namespace)
          if (previous.name === jobName && (plan.base_incarnation !== identity.incarnation || plan.base_version !== identity.version || plan.base_revision !== identity.revision)) {
            await failDeployment(deployment, 'The Trellis job changed while Bower was preparing automatic rollback; Bower did not overwrite it.', { plan })
            continue
          }
          const applied = await client.applyJobPlan(previous, previous.namespace, plan)
          if (previous.name !== jobName) {
            const failedJob = await client.getJob(jobName, env.trellisNamespace)
            if (!sameJobIdentity(failedJob, identity)) {
              await failDeployment(deployment, 'The failed Trellis track changed during automatic rollback; Bower left routing and the competing job unchanged.', { plan, applied })
              continue
            }
          }
          if (previousImage) {
            const overrides = { ...((config.overrides ?? {}) as Record<string, unknown>), image: previousImage }
            await db.update(serviceConfigs).set({ image: previousImage, overrides, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id))
          }
          if (deployment.strategy === 'blue_green' || deployment.strategy === 'canary') {
            await db.update(serviceConfigs).set({ activeJobName: previous.name, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id))
            if (jobName !== previous.name) await client.deleteJob(jobName, env.trellisNamespace).catch(() => undefined)
          }
          await db.update(deployments).set({ status: 'rolled_back', completedAt: new Date() }).where(eq(deployments.id, deployment.id))
          await recordDeploymentEvent(deployment.id, 'auto_rollback', 'Deployment deadline elapsed; Trellis accepted the previous known-good JobSpec.', { plan, applied, convergence })
        } else {
          await failDeployment(deployment, 'Deployment did not converge before its deadline and there is no previous JobSpec to restore.', { elapsedSeconds: elapsed, convergence })
          continue
        }
        await syncManagedProxy(projectId, env.id, orgId).catch(() => undefined)
        await notifyDeployment(await createDeploymentSpec(deployment.serviceId, deployment.environmentId), 'rolled_back', deployment.triggeredByUserId)
        continue
      }
      if (deployment.strategy === 'canary') {
        const steps = [...new Set([...(config.canarySteps as number[]), 100])].filter((step) => step > 0 && step <= 100).sort((a, b) => a - b)
        const existing = await db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, deployment.id)).orderBy(desc(deploymentEvents.createdAt))
        const previousWeight = Number((existing.find((entry) => entry.type === 'canary_step')?.details as { weight?: number } | undefined)?.weight ?? 0)
        const nextWeight = steps.find((step) => step > previousWeight)
        if (nextWeight) {
          const replicas = Math.max(1, Math.ceil(config.replicas * nextWeight / 100))
          const { spec } = await createDeploymentSpec(deployment.serviceId, deployment.environmentId, jobName, { replicas, labels: { 'trellis/weight': String(nextWeight), 'bower/canary': 'true' } })
          const plan = await client.planJob(spec, env.trellisNamespace)
          if (plan.base_incarnation !== identity.incarnation || plan.base_version !== identity.version || plan.base_revision !== identity.revision) {
            await failDeployment(deployment, 'The Trellis job changed while Bower was preparing canary advancement; Bower did not overwrite it.', { plan })
            continue
          }
          const applied = await client.applyJobPlan(spec, env.trellisNamespace, plan)
          await db.update(deployments).set({ jobSpec: spec, trellisIncarnation: applied.incarnation, trellisVersion: applied.version, trellisRevision: applied.revision }).where(eq(deployments.id, deployment.id))
          await recordDeploymentEvent(deployment.id, 'canary_step', `Canary advanced to ${nextWeight}% at version ${applied.version}, revision ${applied.revision}.`, { weight: nextWeight, replicas, plan, applied })
          await syncManagedProxy(projectId, env.id, orgId)
          continue
        }
        await recordDeploymentEvent(deployment.id, 'canary_complete', 'Canary reached 100%; traffic switched atomically.', { weight: 100 })
      }
      if (deployment.strategy === 'blue_green' || deployment.strategy === 'canary') {
        const oldJob = config.activeJobName || item.serviceSlug
        await db.update(serviceConfigs).set({ activeJobName: jobName, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id))
        await syncManagedProxy(projectId, env.id, orgId)
        if (oldJob !== jobName) await client.deleteJob(oldJob, env.trellisNamespace).catch(() => undefined)
      }
      await db.update(deployments).set({ status: 'healthy', completedAt: new Date() }).where(eq(deployments.id, deployment.id))
      await recordDeploymentEvent(deployment.id, 'healthy', 'The accepted job version reached its desired healthy group counts.', { identity, groups: convergence.groups })
      await notifyDeployment(await createDeploymentSpec(deployment.serviceId, deployment.environmentId), 'healthy', deployment.triggeredByUserId)
    } catch (error) {
      if (error instanceof TrellisApiError && error.status === 409) {
        await failDeployment(deployment, 'The Trellis job changed during a conditional apply; Bower did not overwrite the competing change.')
        continue
      }
      if (error instanceof TrellisApiError && error.status === 404) {
        await failDeployment(deployment, 'The accepted Trellis job no longer exists; Bower will not recreate it over an external deletion.')
        continue
      }
      await recordDiagnosticOnce(deployment.id, 'reconciliation_error', 'Bower could not reconcile this deployment with Trellis.', {
        message: error instanceof Error ? error.message : 'Unknown reconciliation error.',
      })
    }
  }
}

export async function reconcileAllDeployments() {
  if (reconciliationRunning) return
  reconciliationRunning = true
  try {
    const activeProjects = await db.selectDistinct({ projectId: projects.id, orgId: projects.orgId })
      .from(deployments)
      .innerJoin(services, eq(services.id, deployments.serviceId))
      .innerJoin(projects, eq(projects.id, services.projectId))
      .where(inArray(deployments.status, [...ACTIVE_STATUSES]))
    await Promise.allSettled(activeProjects.map(({ projectId, orgId }) => reconcileProjectDeployments(projectId, orgId)))
  } finally {
    reconciliationRunning = false
  }
}
