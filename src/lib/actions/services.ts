'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { baseServiceConfigs, deployments, environments, serviceConfigs, services } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getProjectEnvironment, getUserOrganization } from '@/lib/queries'
import { getTrellisClient, getTrellisJobLimits } from '@/lib/trellis-instance'
import { TrellisApiError } from '@/lib/trellis'
import { trellisWriteError } from '@/lib/trellis-runtime'
import { ActionError } from '@/lib/action-error'
import { recordAudit, requireProject, requireService } from '@/lib/actions/shared'
import { syncManagedProxy } from '@/lib/managed-proxy'
import { createDeploymentSpec, notifyDeployment, recordDeploymentEvent } from '@/lib/deployment-runtime'
import { reconcileProjectDeployments } from '@/lib/deployment-reconciler'
import { cleanupTrellisResources } from '@/lib/trellis-cleanup'
import type { TrellisJobApplyResult, TrellisJobSpec } from '@/types/trellis'
import { parseDeploymentStrategy, parseHealthCheckInput, parseResourceInputs, positiveInteger, validateWorkloadAdmissionBounds } from '@/lib/service-config-input'
import { validateCanarySteps } from '@/lib/workload-input'
import { releaseImagePins } from '@/lib/service-releases'

type Trigger = 'manual' | 'webhook' | 'rollback' | 'auto_rollback'
type AutomationActor = { actorType: 'api_key'; apiKeyId: string; userId: string } | { actorType: 'webhook'; userId?: null }

function deploymentApplyError(error: unknown) {
  if (error instanceof TrellisApiError && error.status === 409) {
    return new ActionError('The Trellis job changed after Bower planned this deployment. Review the competing change and deploy again.')
  }
  return error
}

type ActionResult = { error?: string }

// Failures the user can act on go back as a message. Anything else is rethrown:
// React redacts it in production, and the client shows its own fallback.
function actionFailure(error: unknown): { error: string } {
  if (error instanceof ActionError) return { error: error.message }
  if (error instanceof TrellisApiError) return { error: trellisWriteError(error) }
  throw error
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63) || 'service'
}

async function executeDeployment(serviceId: string, environmentId: string, triggerType: Trigger, userId?: string | null, actor?: AutomationActor) {
  const row = await createDeploymentSpec(serviceId, environmentId)
  const [previous] = await db.select().from(deployments).where(and(eq(deployments.serviceId, serviceId), eq(deployments.environmentId, environmentId), eq(deployments.status, 'healthy'))).orderBy(desc(deployments.createdAt)).limit(1)
  let jobName = row.service.slug
  let spec = row.spec
  let initialCanary: { weight: number; replicas: number } | null = null
  if (row.config.deploymentStrategy === 'blue_green') {
    const active = row.config.activeJobName || row.service.slug
    jobName = active.endsWith('-blue') ? `${row.service.slug}-green` : `${row.service.slug}-blue`
    spec = (await createDeploymentSpec(serviceId, environmentId, jobName)).spec
  } else if (row.config.deploymentStrategy === 'canary') {
    const active = row.config.activeJobName || row.service.slug
    jobName = active.endsWith('-canary-a') ? `${row.service.slug}-canary-b` : `${row.service.slug}-canary-a`
    const steps = validateCanarySteps(row.config.canarySteps)
    const weight = steps[0] ?? 10
    const replicas = Math.max(1, Math.ceil(row.config.replicas * weight / 100))
    initialCanary = { weight, replicas }
    spec = (await createDeploymentSpec(serviceId, environmentId, jobName, { replicas, labels: { 'trellis/weight': String(weight), 'bower/canary': 'true' } })).spec
  }
  const [deployment] = await db.insert(deployments).values({
    serviceId, environmentId, imageAfter: row.config.image, imageBefore: previous?.imageAfter ?? null,
    strategy: row.config.deploymentStrategy, status: 'planning', triggeredByUserId: userId ?? null,
    triggerType, jobSpec: spec, previousJobSpec: previous?.jobSpec ?? null, trellisJobName: jobName,
  }).returning()
  await recordDeploymentEvent(deployment.id, 'planning', 'Generated Trellis JobSpec and requested a semantic plan.')
  let applied: TrellisJobApplyResult
  try {
    const client = await getTrellisClient(row.project.orgId)
    const plan = await client.planJob(spec, row.environment.trellisNamespace)
    await db.update(deployments).set({ planDiff: { ...plan, previous_resolved_images: releaseImagePins(previous?.jobSpec, previous?.planDiff) } }).where(eq(deployments.id, deployment.id))
    await recordDeploymentEvent(deployment.id, 'deploying', `Applying ${jobName}.`, { plan })
    applied = await client.applyJobPlan(spec, row.environment.trellisNamespace, plan)
  } catch (error) {
    const reported = deploymentApplyError(error)
    await db.update(deployments).set({ status: 'failed', completedAt: new Date() }).where(eq(deployments.id, deployment.id))
    await recordDeploymentEvent(deployment.id, 'failed', reported instanceof Error ? reported.message : 'Deployment failed.')
    await notifyDeployment(row, 'failed', userId)
    throw reported
  }
  await db.update(deployments).set({
    status: 'deploying',
    trellisIncarnation: applied.incarnation,
    trellisVersion: applied.version,
    trellisRevision: applied.revision,
  }).where(eq(deployments.id, deployment.id))
  const followUps = await Promise.allSettled([
    recordDeploymentEvent(deployment.id, 'apply_accepted', `Trellis accepted ${jobName} version ${applied.version}, revision ${applied.revision}.`, { ...applied }),
    ...(initialCanary ? [recordDeploymentEvent(deployment.id, 'canary_step', `Canary started at ${initialCanary.weight}%.`, initialCanary)] : []),
    recordAudit({ orgId: row.project.orgId, userId: userId ?? null, actorType: actor?.actorType, apiKeyId: actor?.actorType === 'api_key' ? actor.apiKeyId : null, action: `deployment.${triggerType}`, resourceType: 'deployment', resourceId: deployment.id, details: { serviceId, serviceName: row.service.name, environmentId, environmentName: row.environment.name, image: row.config.image, strategy: row.config.deploymentStrategy } }),
    notifyDeployment(row, 'deploying', userId),
  ])
  for (const result of followUps) if (result.status === 'rejected') console.error(`Deployment ${deployment.id} follow-up failed.`, result.reason)
  return { deployment, row }
}

export async function createServiceAction(projectSlug: string, formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser(); if (!user) return { error: 'Not authenticated.' }
  const ctx = await getUserOrganization(user.id); if (!ctx) return { error: 'No organization found.' }
  const project = await getProjectBySlug(ctx.org.id, projectSlug); if (!project) return { error: 'Project not found.' }
  const access = await requireProject(project.id); if (access.projectRole !== 'admin') return { error: 'Insufficient permissions.' }
  const name = String(formData.get('name') ?? '').trim(); const image = String(formData.get('image') ?? '').trim()
  if (!name || !image) return { error: 'Name and image are required.' }
  const slug = slugify(name); const [duplicate] = await db.select().from(services).where(and(eq(services.projectId, project.id), eq(services.slug, slug))).limit(1)
  if (duplicate) return { error: 'A service with this name already exists.' }
  const environment = await getProjectEnvironment(project.id)
  let resources: ReturnType<typeof parseResourceInputs>
  let strategy: ReturnType<typeof parseDeploymentStrategy>
  let healthCheck: ReturnType<typeof parseHealthCheckInput>
  let replicas: number | null
  try {
    resources = parseResourceInputs(String(formData.get('cpu') ?? '100'), String(formData.get('memory') ?? '128'))
    strategy = parseDeploymentStrategy(String(formData.get('strategy') ?? 'recreate'))
    healthCheck = parseHealthCheckInput(formData)
    replicas = formData.has('replicas') ? positiveInteger(Number(formData.get('replicas')), 'Replicas') : null
    validateWorkloadAdmissionBounds(replicas ?? Math.max(1, environment?.defaultReplicas ?? 1), resources.cpu, resources.memory, await getTrellisJobLimits(ctx.org.id))
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid workload configuration.' }
  }
  const { cpu, memory } = resources
  const [service] = await db.insert(services).values({ projectId: project.id, name, slug }).returning()
  const baseReplicas = replicas ?? 1
  await db.insert(baseServiceConfigs).values({
    serviceId: service.id, image, replicas: baseReplicas, cpu, memory,
    resourceTier: (environment?.resourceTier ?? 'small') as 'small' | 'medium' | 'large' | 'xl' | 'custom',
    deploymentStrategy: strategy,
    ...healthCheck,
  })
  if (environment) await db.insert(serviceConfigs).values({
    serviceId: service.id, environmentId: environment.id, image,
    replicas: replicas ?? Math.max(1, environment.defaultReplicas),
    cpu, memory,
    resourceTier: environment.resourceTier as 'small' | 'medium' | 'large' | 'xl' | 'custom',
    deploymentStrategy: strategy,
    ...healthCheck,
  }).returning()
  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'service.created', resourceType: 'service', resourceId: service.id, details: { before: null, after: { name, image } } })
  revalidatePath(`/projects/${projectSlug}`)
  redirect(`/projects/${projectSlug}/services/${slug}`)
}

export async function deployServiceAction(serviceId: string, environmentId: string): Promise<ActionResult> {
  try { await deployService(serviceId, environmentId); return {} } catch (error) { return actionFailure(error) }
}

async function deployService(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new ActionError('Insufficient permissions.')
  const { deployment } = await executeDeployment(serviceId, environmentId, 'manual', access.user.id)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.deployed', resourceType: 'deployment', resourceId: deployment.id, details: { serviceId, environmentId } })
    .catch((error) => console.error(`Deployment ${deployment.id} audit failed.`, error))
  revalidatePath(`/projects/${access.project.slug}`)
}

export async function deployServiceFromAutomation(serviceId: string, environmentId: string, image: string, trigger: 'webhook' | 'manual', actor: AutomationActor) {
  const [row] = await db.select({ config: serviceConfigs }).from(serviceConfigs).innerJoin(environments, eq(environments.id, serviceConfigs.environmentId)).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1)
  if (!row) throw new Error('Service environment not found.')
  const overrides = { ...((row.config.overrides ?? {}) as Record<string, unknown>), image }
  await db.update(serviceConfigs).set({ image, overrides, updatedAt: new Date() }).where(eq(serviceConfigs.id, row.config.id))
  return executeDeployment(serviceId, environmentId, trigger, actor.userId ?? null, actor)
}

export async function rollbackServiceAction(serviceId: string, environmentId: string, targetDeploymentId?: string): Promise<ActionResult> {
  try { await rollbackService(serviceId, environmentId, targetDeploymentId); return {} } catch (error) { return actionFailure(error) }
}

async function rollbackService(serviceId: string, environmentId: string, targetDeploymentId?: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new ActionError('Insufficient permissions.')
  const [last] = await db.select().from(deployments).where(and(eq(deployments.serviceId, serviceId), eq(deployments.environmentId, environmentId))).orderBy(desc(deployments.createdAt)).limit(1)
  let storedSpec = last?.previousJobSpec
  let storedPins = releaseImagePins(storedSpec, { resolved_images: (last?.planDiff as { previous_resolved_images?: Record<string, string> } | null)?.previous_resolved_images })
  let target = null
  if (targetDeploymentId) {
    ;[target] = await db.select().from(deployments).where(and(eq(deployments.id, targetDeploymentId), eq(deployments.serviceId, serviceId), eq(deployments.environmentId, environmentId), eq(deployments.status, 'healthy'))).limit(1)
    if (!target?.jobSpec) throw new ActionError('This deployment has no successful stored JobSpec available for rollback.')
  }
  const [configRow] = await db.select({ config: serviceConfigs, environment: environments }).from(serviceConfigs).innerJoin(environments, eq(environments.id, serviceConfigs.environmentId)).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1)
  if (!configRow) throw new ActionError('Configuration not found.')
  if (target) {
    const jobName = configRow.config.activeJobName || access.service.slug
    const client = await getTrellisClient(access.org.id)
    const runtime = await client.getJob(jobName, configRow.environment.trellisNamespace)
    if (target.trellisJobName === jobName && target.trellisIncarnation === runtime.incarnation && target.trellisVersion === runtime.version && target.trellisRevision === runtime.revision) {
      throw new ActionError('The selected release is currently running and cannot be a rollback target.')
    }
    const [active] = await db.select().from(deployments).where(and(eq(deployments.serviceId, serviceId), eq(deployments.environmentId, environmentId), eq(deployments.trellisJobName, jobName), eq(deployments.trellisIncarnation, runtime.incarnation), eq(deployments.trellisVersion, runtime.version), eq(deployments.trellisRevision, runtime.revision))).limit(1)
    if (!active || target.createdAt >= active.createdAt) throw new ActionError('Only successful releases earlier than the currently running release can be restored.')
    storedSpec = target.jobSpec
    storedPins = releaseImagePins(storedSpec, target.planDiff)
  }
  if (!storedSpec) throw new ActionError('No stored previous JobSpec is available.')
  if (!storedPins) throw new ActionError('This release has no stored image pins and cannot be restored exactly. Deploy an image digest instead.')
  const spec = storedSpec as TrellisJobSpec; const config = configRow.config
  const image = spec.task_groups[0]?.tasks[0]?.image
  const fallbackSpec = last?.status === 'healthy' ? last.jobSpec : last?.previousJobSpec
  const fallbackPins = last?.status === 'healthy' ? releaseImagePins(last.jobSpec, last.planDiff) : releaseImagePins(fallbackSpec, { resolved_images: (last?.planDiff as { previous_resolved_images?: Record<string, string> } | null)?.previous_resolved_images })
  const [deployment] = await db.insert(deployments).values({ serviceId, environmentId, imageBefore: config.image, imageAfter: image || config.image, strategy: config.deploymentStrategy, status: 'planning', triggeredByUserId: access.user.id, triggerType: 'rollback', jobSpec: spec, previousJobSpec: fallbackSpec ?? null, trellisJobName: spec.name }).returning()
  await recordDeploymentEvent(deployment.id, 'planning', 'Planning the exact stored JobSpec for manual rollback.')
  let applied: TrellisJobApplyResult
  try {
    const client = await getTrellisClient(access.org.id)
    const plan = await client.planJob(spec, spec.namespace, storedPins)
    await db.update(deployments).set({ planDiff: { ...plan, previous_resolved_images: fallbackPins } }).where(eq(deployments.id, deployment.id))
    applied = await client.applyJobPlan(spec, spec.namespace, plan)
  } catch (error) {
    const reported = deploymentApplyError(error)
    await db.update(deployments).set({ status: 'failed', completedAt: new Date() }).where(eq(deployments.id, deployment.id))
    await recordDeploymentEvent(deployment.id, 'failed', reported instanceof Error ? reported.message : 'Rollback failed.')
    throw reported
  }
  await db.update(deployments).set({ status: 'deploying', trellisIncarnation: applied.incarnation, trellisVersion: applied.version, trellisRevision: applied.revision }).where(eq(deployments.id, deployment.id))
  if (image) {
    const overrides = { ...((config.overrides ?? {}) as Record<string, unknown>), image }
    await db.update(serviceConfigs).set({ image, overrides, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id))
  }
  const followUps = await Promise.allSettled([
    recordDeploymentEvent(deployment.id, 'rollback', `Trellis accepted rollback version ${applied.version}, revision ${applied.revision}.`, { ...applied }),
    createDeploymentSpec(serviceId, environmentId).then((row) => notifyDeployment(row, 'deploying', access.user.id)),
    recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.rollback.requested', resourceType: 'deployment', resourceId: deployment.id, details: { serviceId, serviceName: access.service.name, environmentId, environmentName: configRow.environment?.name, ...(targetDeploymentId ? { targetDeploymentId } : {}) } }),
  ])
  for (const result of followUps) if (result.status === 'rejected') console.error(`Rollback ${deployment.id} follow-up failed.`, result.reason)
}

export async function refreshDeploymentStatusesAction(projectId: string) {
  const access = await requireProject(projectId)
  await reconcileProjectDeployments(projectId, access.org.id)
  revalidatePath(`/projects/${access.project.slug}/deployments`)
}

export async function restartServiceAction(serviceId: string, environmentId: string): Promise<ActionResult> {
  try { await restartService(serviceId, environmentId); return {} } catch (error) { return actionFailure(error) }
}

async function restartService(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new ActionError('Insufficient permissions.')
  const [row] = await db.select({ config: serviceConfigs, environment: environments }).from(serviceConfigs).innerJoin(environments, eq(environments.id, serviceConfigs.environmentId)).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1)
  if (!row) throw new ActionError('Service configuration not found.')
  const jobName = (row.config.activeJobName as string | null) || access.service.slug
  const client = await getTrellisClient(access.org.id)
  await client.restartJob(jobName, row.environment.trellisNamespace)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.restarted', resourceType: 'service', resourceId: serviceId, details: { serviceName: access.service.name, environmentId, environmentName: row.environment.name, jobName } })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function deleteServiceAction(serviceId: string, projectSlug: string): Promise<{ error?: string }> {
  const access = await requireService(serviceId); if (access.projectRole !== 'admin') return { error: 'Insufficient permissions.' }
  const configs = await db.select({ config: serviceConfigs, environment: environments }).from(serviceConfigs).innerJoin(environments, eq(environments.id, serviceConfigs.environmentId)).where(eq(serviceConfigs.serviceId, serviceId))
  const client = await getTrellisClient(access.org.id)
  try {
    for (const { config, environment } of configs) {
      const names = new Set([access.service.slug, config.activeJobName, `${access.service.slug}-blue`, `${access.service.slug}-green`, `${access.service.slug}-canary-a`, `${access.service.slug}-canary-b`].filter(Boolean) as string[])
      await cleanupTrellisResources([...names].map((name) => client.deleteJob(name, environment.trellisNamespace)))
      // Remove ingress routes before discarding the records needed to retry cleanup.
      await syncManagedProxy(access.project.id, environment.id, access.org.id, serviceId)
    }
  } catch {
    return { error: 'Trellis cleanup failed. The service was not deleted. Check connectivity and permissions, then retry.' }
  }
  await db.delete(services).where(eq(services.id, serviceId))
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.deleted', resourceType: 'service', resourceId: serviceId }); redirect(`/projects/${projectSlug}`)
}
