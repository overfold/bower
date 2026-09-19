import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { deploymentEvents, deployments, environments, projects, serviceConfigs, services } from '@/db/schema'
import { createDeploymentSpec, notifyDeployment, recordDeploymentEvent } from '@/lib/deployment-runtime'
import { getDeploymentsByProject } from '@/lib/queries'
import { syncManagedProxy } from '@/lib/managed-proxy'
import { getTrellisClient } from '@/lib/trellis-instance'
import type { TrellisJobSpec } from '@/types/trellis'

const ACTIVE_STATUSES = ['pending', 'planning', 'deploying'] as const
let reconciliationRunning = false

async function recordDiagnosticOnce(deploymentId: string, type: string, message: string, details: Record<string, unknown>) {
  const existing = await db.select({ id: deploymentEvents.id }).from(deploymentEvents).where(and(
    eq(deploymentEvents.deploymentId, deploymentId),
    eq(deploymentEvents.type, type),
  )).limit(1)
  if (!existing.length) await recordDeploymentEvent(deploymentId, type, message, details)
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
      const allocations = await client.listAllocations({ namespace: env.trellisNamespace, job: jobName })
      const latestRevision = allocations.length ? Math.max(...allocations.map((allocation) => allocation.job_revision)) : 0
      const currentAllocations = allocations.filter((allocation) => allocation.job_revision === latestRevision && allocation.phase !== 'stopped')
      const failed = currentAllocations.some((allocation) => allocation.phase === 'failed' || allocation.phase === 'lost' || allocation.health === 'unhealthy')
      const elapsed = (Date.now() - new Date(deployment.startedAt).getTime()) / 1000
      const blocked = currentAllocations.filter((allocation) => allocation.phase === 'pending')
      if (blocked.length) {
        await recordDiagnosticOnce(deployment.id, 'scheduling_blocked', 'Trellis could not schedule the new allocation.', {
          allocations: blocked.map(({ id, reason, message, phase }) => ({ id, reason, message, phase })),
        })
      }
      const timedOut = elapsed >= config.autoRollbackSeconds && (!currentAllocations.length || blocked.length > 0)
      if (timedOut) {
        await db.update(deployments).set({ status: 'failed', completedAt: new Date() }).where(eq(deployments.id, deployment.id))
        await recordDiagnosticOnce(deployment.id, 'failed', 'Deployment did not obtain healthy allocations before the failure grace period elapsed.', {
          elapsedSeconds: elapsed,
          allocations: currentAllocations.map(({ id, phase, health, reason, message }) => ({ id, phase, health, reason, message })),
        })
        await notifyDeployment(await createDeploymentSpec(deployment.serviceId, deployment.environmentId), 'failed', deployment.triggeredByUserId)
        continue
      }
      if (failed && elapsed >= config.autoRollbackSeconds) {
        if (deployment.previousJobSpec) {
          const previous = deployment.previousJobSpec as TrellisJobSpec
          const previousImage = previous.task_groups[0]?.tasks[0]?.image
          await client.applyJob(previous, previous.namespace)
          if (previousImage) {
            const overrides = { ...((config.overrides ?? {}) as Record<string, unknown>), image: previousImage }
            await db.update(serviceConfigs).set({ image: previousImage, overrides, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id))
          }
          if (deployment.strategy === 'blue_green' || deployment.strategy === 'canary') {
            await db.update(serviceConfigs).set({ activeJobName: previous.name, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id))
            if (jobName !== previous.name) await client.deleteJob(jobName, env.trellisNamespace).catch(() => undefined)
          }
          await db.update(deployments).set({ status: 'rolled_back', completedAt: new Date() }).where(eq(deployments.id, deployment.id))
          await recordDeploymentEvent(deployment.id, 'auto_rollback', 'Health threshold elapsed; restored the previous known-good JobSpec.')
        } else {
          await db.update(deployments).set({ status: 'failed', completedAt: new Date() }).where(eq(deployments.id, deployment.id))
          await recordDeploymentEvent(deployment.id, 'failed', 'Allocations failed and there is no previous JobSpec to restore.')
        }
        await syncManagedProxy(projectId, env.id, orgId).catch(() => undefined)
        await notifyDeployment(await createDeploymentSpec(deployment.serviceId, deployment.environmentId), deployment.previousJobSpec ? 'rolled_back' : 'failed', deployment.triggeredByUserId)
        continue
      }
      const healthy = currentAllocations.length > 0 && currentAllocations.every((allocation) => allocation.phase === 'running' && allocation.health === 'healthy')
      if (!healthy) continue
      if (deployment.strategy === 'canary') {
        const steps = [...new Set([...(config.canarySteps as number[]), 100])].filter((step) => step > 0 && step <= 100).sort((a, b) => a - b)
        const existing = await db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, deployment.id)).orderBy(desc(deploymentEvents.createdAt))
        const previousWeight = Number((existing.find((entry) => entry.type === 'canary_step')?.details as { weight?: number } | undefined)?.weight ?? 0)
        const nextWeight = steps.find((step) => step > previousWeight)
        if (nextWeight) {
          const replicas = Math.max(1, Math.ceil(config.replicas * nextWeight / 100))
          const { spec } = await createDeploymentSpec(deployment.serviceId, deployment.environmentId, jobName, { replicas, labels: { 'trellis/weight': String(nextWeight), 'bower/canary': 'true' } })
          await client.applyJob(spec, env.trellisNamespace)
          await recordDeploymentEvent(deployment.id, 'canary_step', `Canary advanced to ${nextWeight}%.`, { weight: nextWeight, replicas })
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
      await db.update(deployments).set({ status: 'healthy', completedAt: new Date(), trellisRevision: latestRevision }).where(eq(deployments.id, deployment.id))
      await recordDeploymentEvent(deployment.id, 'healthy', 'All allocations are running and healthy.', { allocations: currentAllocations.map((allocation) => ({ id: allocation.id, phase: allocation.phase, health: allocation.health })) })
      await notifyDeployment(await createDeploymentSpec(deployment.serviceId, deployment.environmentId), 'healthy', deployment.triggeredByUserId)
    } catch (error) {
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
