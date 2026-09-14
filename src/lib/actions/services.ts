'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { deployments, environments, serviceConfigs, serviceDeployments, services, sidecars } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getUserOrganization } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { recordAudit, requireProject, requireService } from '@/lib/actions/shared'
import { syncManagedProxy } from '@/lib/managed-proxy'
import { createDeploymentSpec, notifyDeployment, recordDeploymentEvent } from '@/lib/deployment-runtime'
import { reconcileProjectDeployments } from '@/lib/deployment-reconciler'
import type { TrellisExecResponse, TrellisJobSpec, TrellisVolume } from '@/types/trellis'

type Trigger = 'manual' | 'webhook' | 'promotion' | 'rollback' | 'auto_rollback'
type ResourceTier = 'small' | 'medium' | 'large' | 'xl' | 'custom'

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63) || 'service'
}

function linesToRecord(value: string) {
  const result: Record<string, string> = {}
  for (const line of value.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const split = line.indexOf('=')
    if (split < 1) throw new Error(`Invalid key/value line: ${line}`)
    result[line.slice(0, split).trim()] = line.slice(split + 1).trim()
  }
  return result
}

function jsonField<T>(formData: FormData, key: string, fallback: T): T {
  const value = String(formData.get(key) ?? '').trim()
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { throw new Error(`${key} must contain valid JSON.`) }
}

function inferResourceTier(cpu: number, memory: number): ResourceTier {
  const tiers: Array<[ResourceTier, number, number]> = [
    ['small', 100, 134217728],
    ['medium', 250, 268435456],
    ['large', 500, 536870912],
    ['xl', 1000, 1073741824],
  ]
  return tiers.find(([, tierCpu, tierMemory]) => cpu === tierCpu && memory === tierMemory)?.[0] ?? 'custom'
}

async function applyReplicaCountToCurrentJob({
  orgId,
  serviceId,
  serviceSlug,
  environmentId,
  namespace,
  activeJobName,
  replicas,
}: {
  orgId: string
  serviceId: string
  serviceSlug: string
  environmentId: string
  namespace: string
  activeJobName: string | null
  replicas: number
}) {
  const [latestHealthy] = await db.select({ trellisJobName: deployments.trellisJobName })
    .from(deployments)
    .where(and(
      eq(deployments.serviceId, serviceId),
      eq(deployments.environmentId, environmentId),
      eq(deployments.status, 'healthy'),
    ))
    .orderBy(desc(deployments.createdAt))
    .limit(1)
  if (!latestHealthy) return false

  const jobName = activeJobName || latestHealthy.trellisJobName || serviceSlug
  const client = await getTrellisClient(orgId)
  const job = await client.getJob(jobName, namespace)
  let groupIndex = job.spec.task_groups.findIndex((group) => group.name === jobName || group.name === serviceSlug)
  if (groupIndex < 0 && job.spec.task_groups.length === 1) groupIndex = 0
  if (groupIndex < 0) throw new Error('Could not determine which task group represents this service deployment.')

  const spec: TrellisJobSpec = {
    ...job.spec,
    task_groups: job.spec.task_groups.map((group, index) => index === groupIndex ? { ...group, count: replicas } : group),
  }
  await client.applyJob(spec, namespace)
  return true
}

async function executeDeployment(serviceId: string, environmentId: string, triggerType: Trigger, userId?: string | null) {
  const row = await createDeploymentSpec(serviceId, environmentId)
  if (row.environment.isLocked && triggerType === 'webhook') throw new Error('This environment is locked and requires an administrator.')
  const [previous] = await db.select().from(deployments).where(and(
    eq(deployments.serviceId, serviceId),
    eq(deployments.environmentId, environmentId),
    eq(deployments.status, 'healthy'),
  )).orderBy(desc(deployments.createdAt)).limit(1)

  let jobName = row.service.slug
  let spec = row.spec
  let initialCanary: { weight: number; replicas: number } | null = null
  if (row.config.deploymentStrategy === 'blue_green') {
    const active = row.target.activeJobName || row.service.slug
    jobName = active.endsWith('-blue') ? `${row.service.slug}-green` : `${row.service.slug}-blue`
    spec = (await createDeploymentSpec(serviceId, environmentId, jobName)).spec
  } else if (row.config.deploymentStrategy === 'canary') {
    const active = row.target.activeJobName || row.service.slug
    jobName = active.endsWith('-canary-a') ? `${row.service.slug}-canary-b` : `${row.service.slug}-canary-a`
    const steps = [...new Set(row.config.canarySteps as number[])].filter((step) => step > 0 && step <= 100).sort((a, b) => a - b)
    const weight = steps[0] ?? 10
    const replicas = Math.max(1, Math.ceil(row.target.replicas * weight / 100))
    initialCanary = { weight, replicas }
    spec = (await createDeploymentSpec(serviceId, environmentId, jobName, {
      replicas,
      labels: { 'trellis/weight': String(weight), 'bower/canary': 'true' },
    })).spec
  }

  const [deployment] = await db.insert(deployments).values({
    serviceId,
    environmentId,
    imageAfter: row.config.image,
    imageBefore: previous?.imageAfter ?? null,
    strategy: row.config.deploymentStrategy,
    status: 'planning',
    triggeredByUserId: userId ?? null,
    triggerType,
    jobSpec: spec,
    previousJobSpec: previous?.jobSpec ?? null,
    trellisJobName: jobName,
  }).returning()
  await recordDeploymentEvent(deployment.id, 'planning', 'Generated Trellis JobSpec and requested a semantic plan.')

  try {
    const client = await getTrellisClient(row.project.orgId)
    const plan = await client.planJob(spec, row.environment.trellisNamespace)
    await db.update(deployments).set({ status: 'deploying', planDiff: plan }).where(eq(deployments.id, deployment.id))
    await recordDeploymentEvent(deployment.id, 'deploying', `Applying ${jobName}.`, { plan })
    const result = await client.applyJob(spec, row.environment.trellisNamespace)
    if (result?.revision) await db.update(deployments).set({ trellisRevision: result.revision }).where(eq(deployments.id, deployment.id))
    if (initialCanary) await recordDeploymentEvent(deployment.id, 'canary_step', `Canary started at ${initialCanary.weight}%.`, initialCanary)
    await recordAudit({
      orgId: row.project.orgId,
      userId: userId ?? null,
      action: `deployment.${triggerType}`,
      resourceType: 'deployment',
      resourceId: deployment.id,
      details: { serviceId, environmentId, image: row.config.image, replicas: row.target.replicas, strategy: row.config.deploymentStrategy },
    })
    await notifyDeployment(row, 'deploying', userId)
  } catch (error) {
    await db.update(deployments).set({ status: 'failed', completedAt: new Date() }).where(eq(deployments.id, deployment.id))
    await recordDeploymentEvent(deployment.id, 'failed', error instanceof Error ? error.message : 'Deployment failed.')
    await notifyDeployment(row, 'failed', userId)
    throw error
  }
  return { deployment, row }
}

export async function createServiceAction(projectSlug: string, formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser(); if (!user) return { error: 'Not authenticated.' }
  const ctx = await getUserOrganization(user.id); if (!ctx) return { error: 'No organization found.' }
  const project = await getProjectBySlug(ctx.org.id, projectSlug); if (!project) return { error: 'Project not found.' }
  const access = await requireProject(project.id); if (access.projectRole !== 'admin') return { error: 'Insufficient permissions.' }
  const name = String(formData.get('name') ?? '').trim()
  const image = String(formData.get('image') ?? '').trim()
  if (!name || !image) return { error: 'Name and image are required.' }
  const slug = slugify(name)
  const [duplicate] = await db.select().from(services).where(and(eq(services.projectId, project.id), eq(services.slug, slug))).limit(1)
  if (duplicate) return { error: 'A service with this name already exists.' }

  const port = Number(formData.get('port')) || null
  const cpu = Number(formData.get('cpu')) || 100
  const memory = (Number(formData.get('memory')) || 128) * 1048576
  const strategy = (String(formData.get('strategy') ?? '') || 'recreate') as 'rolling' | 'recreate' | 'blue_green' | 'canary'
  const resourceTier = inferResourceTier(cpu, memory)

  const [service] = await db.insert(services).values({ projectId: project.id, name, slug }).returning()
  await db.insert(serviceConfigs).values({
    serviceId: service.id,
    image,
    port,
    cpu,
    memory,
    resourceTier,
    deploymentStrategy: strategy,
    healthCheckType: port ? 'http' : undefined,
    healthCheckPath: port ? '/health' : null,
  })
  const envs = await db.select().from(environments).where(eq(environments.projectId, project.id))
  if (envs.length) await db.insert(serviceDeployments).values(envs.map((environment) => ({
    serviceId: service.id,
    environmentId: environment.id,
    replicas: 1,
  })))

  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'service.created', resourceType: 'service', resourceId: service.id, details: { before: null, after: { name, image } } })
  redirect(`/projects/${projectSlug}/services/${slug}`)
}

export async function deployServiceAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [env] = await db.select().from(environments).where(and(eq(environments.id, environmentId), eq(environments.projectId, access.project.id))).limit(1)
  if (!env) throw new Error('Environment not found.')
  if (env.isLocked && access.projectRole !== 'admin') throw new Error('This environment is locked. An administrator must deploy it.')
  const { deployment } = await executeDeployment(serviceId, environmentId, 'manual', access.user.id)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.deployed', resourceType: 'deployment', resourceId: deployment.id, details: { serviceId, environmentId } })
  revalidatePath(`/projects/${access.project.slug}`)
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function deployServiceFromAutomation(serviceId: string, environmentId: string, image: string, trigger: 'webhook' | 'manual', userId?: string | null) {
  const [row] = await db.select({ target: serviceDeployments, environment: environments })
    .from(serviceDeployments)
    .innerJoin(environments, eq(environments.id, serviceDeployments.environmentId))
    .where(and(eq(serviceDeployments.serviceId, serviceId), eq(serviceDeployments.environmentId, environmentId))).limit(1)
  if (!row) throw new Error('Service deployment target not found.')
  if (trigger === 'webhook' && row.environment.isLocked) throw new Error('This environment is locked and requires an administrator.')
  await db.update(serviceConfigs).set({ image, updatedAt: new Date() }).where(eq(serviceConfigs.serviceId, serviceId))
  return executeDeployment(serviceId, environmentId, trigger, userId)
}

export async function promoteServiceAction(serviceId: string, sourceEnvironmentId: string, targetEnvironmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const targets = await db.select().from(serviceDeployments).where(eq(serviceDeployments.serviceId, serviceId))
  if (!targets.some((target) => target.environmentId === sourceEnvironmentId) || !targets.some((target) => target.environmentId === targetEnvironmentId)) {
    throw new Error('Promotion environments were not found.')
  }
  const [config] = await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId)).limit(1)
  if (!config) throw new Error('Service configuration not found.')
  const { deployment } = await executeDeployment(serviceId, targetEnvironmentId, 'promotion', access.user.id)
  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'service.promoted',
    resourceType: 'deployment',
    resourceId: deployment.id,
    details: { sourceEnvironmentId, targetEnvironmentId, image: config.image },
  })
}

export async function rollbackServiceAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [last] = await db.select().from(deployments).where(and(eq(deployments.serviceId, serviceId), eq(deployments.environmentId, environmentId))).orderBy(desc(deployments.createdAt)).limit(1)
  if (!last?.previousJobSpec) throw new Error('No stored previous JobSpec is available.')
  const [config] = await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId)).limit(1)
  const [target] = await db.select().from(serviceDeployments).where(and(eq(serviceDeployments.serviceId, serviceId), eq(serviceDeployments.environmentId, environmentId))).limit(1)
  if (!config || !target) throw new Error('Deployment target not found.')

  const spec = last.previousJobSpec as TrellisJobSpec
  const replacedJob = target.activeJobName
  const image = spec.task_groups[0]?.tasks[0]?.image || last.imageBefore || config.image
  const client = await getTrellisClient(access.org.id)
  const plan = await client.planJob(spec, spec.namespace)
  const [deployment] = await db.insert(deployments).values({
    serviceId,
    environmentId,
    imageBefore: last.imageAfter,
    imageAfter: image,
    strategy: config.deploymentStrategy,
    status: 'deploying',
    triggeredByUserId: access.user.id,
    triggerType: 'rollback',
    planDiff: plan,
    jobSpec: spec,
    previousJobSpec: last.jobSpec,
    trellisJobName: spec.name,
  }).returning()
  await client.applyJob(spec, spec.namespace)
  if (config.deploymentStrategy === 'blue_green' || config.deploymentStrategy === 'canary') {
    await db.update(serviceDeployments).set({ activeJobName: spec.name, updatedAt: new Date() }).where(eq(serviceDeployments.id, target.id))
    await syncManagedProxy(access.project.id, environmentId, access.org.id)
    if (replacedJob && replacedJob !== spec.name) await client.deleteJob(replacedJob, spec.namespace).catch(() => undefined)
  }
  await recordDeploymentEvent(deployment.id, 'rollback', 'Re-applied the exact previous JobSpec for this environment.')
  await notifyDeployment(await createDeploymentSpec(serviceId, environmentId), 'deploying', access.user.id)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.rollback.requested', resourceType: 'deployment', resourceId: deployment.id, details: { environmentId } })
}

export async function refreshDeploymentStatusesAction(projectId: string) {
  const access = await requireProject(projectId)
  await reconcileProjectDeployments(projectId, access.org.id)
  revalidatePath(`/projects/${access.project.slug}/deployments`)
}

export async function updateServiceConfigAction(serviceId: string, formData: FormData) {
  const access = await requireService(serviceId); if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [before] = await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId)).limit(1)
  if (!before) throw new Error('Configuration not found.')
  const image = String(formData.get('image') ?? '').trim()
  if (!image) throw new Error('A valid image is required.')

  const tier = String(formData.get('resourceTier') ?? 'custom') as ResourceTier
  const tiers = { small: [100, 134217728], medium: [250, 268435456], large: [500, 536870912], xl: [1000, 1073741824] } as const
  const cpu = tier === 'custom' ? Number(formData.get('cpu')) : tiers[tier][0]
  const memory = tier === 'custom' ? Number(formData.get('memory')) * 1048576 : tiers[tier][1]
  if (!Number.isFinite(cpu) || cpu <= 0 || !Number.isFinite(memory) || memory <= 0) throw new Error('CPU and memory must be positive values.')

  const after = {
    image,
    port: Number(formData.get('port')) || null,
    resourceTier: tier,
    cpu,
    memory,
    deploymentStrategy: String(formData.get('strategy')) as 'rolling' | 'recreate' | 'blue_green' | 'canary',
    healthCheckType: (String(formData.get('healthType') ?? '') || null) as 'http' | 'tcp' | 'script' | null,
    healthCheckPath: String(formData.get('healthPath') ?? '').trim() || null,
    healthCheckCommand: String(formData.get('healthCommand') ?? '').trim().split(/\s+/).filter(Boolean),
    healthCheckInterval: Number(formData.get('healthInterval')) || 10,
    healthCheckTimeout: Number(formData.get('healthTimeout')) || 2,
    healthCheckThreshold: Number(formData.get('healthThreshold')) || 3,
    labels: linesToRecord(String(formData.get('labels') ?? '')),
    command: String(formData.get('command') ?? '').trim() || null,
    volumes: jsonField<TrellisVolume[]>(formData, 'volumes', []),
    rawConfig: jsonField<TrellisJobSpec | null>(formData, 'rawConfig', null),
    cronSchedule: String(formData.get('cronSchedule') ?? '').trim() || null,
    autoRollbackSeconds: Math.max(30, Number(formData.get('autoRollbackSeconds')) || 300),
    canarySteps: jsonField<number[]>(formData, 'canarySteps', [10, 25, 50, 100]),
    updatedAt: new Date(),
  }
  await db.update(serviceConfigs).set(after).where(eq(serviceConfigs.id, before.id))
  const envs = await db.select({ id: environments.id }).from(environments).where(eq(environments.projectId, access.project.id))
  await Promise.allSettled(envs.map((environment) => syncManagedProxy(access.project.id, environment.id, access.org.id)))
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.config.updated', resourceType: 'service', resourceId: serviceId, details: { before, after } })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function upsertSidecarAction(serviceId: string, formData: FormData) {
  const access = await requireService(serviceId); if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [config] = await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId)).limit(1)
  if (!config) throw new Error('Configuration not found.')
  const id = String(formData.get('id') ?? '')
  const values = {
    serviceConfigId: config.id,
    name: String(formData.get('name') ?? '').trim(),
    image: String(formData.get('image') ?? '').trim(),
    cpu: Number(formData.get('cpu')) || 100,
    memory: (Number(formData.get('memory')) || 128) * 1048576,
    port: Number(formData.get('port')) || null,
    envVars: linesToRecord(String(formData.get('envVars') ?? '')),
    command: String(formData.get('command') ?? '').trim() || null,
  }
  if (!values.name || !values.image) throw new Error('Sidecar name and image are required.')
  if (id) await db.update(sidecars).set(values).where(and(eq(sidecars.id, id), eq(sidecars.serviceConfigId, config.id)))
  else await db.insert(sidecars).values(values)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: id ? 'sidecar.updated' : 'sidecar.created', resourceType: 'service', resourceId: serviceId, details: values })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function deleteSidecarAction(serviceId: string, sidecarId: string) {
  const access = await requireService(serviceId); if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [config] = await db.select({ id: serviceConfigs.id }).from(sidecars).innerJoin(serviceConfigs, eq(serviceConfigs.id, sidecars.serviceConfigId)).where(and(eq(sidecars.id, sidecarId), eq(serviceConfigs.serviceId, serviceId))).limit(1)
  if (!config) throw new Error('Sidecar not found.')
  await db.delete(sidecars).where(eq(sidecars.id, sidecarId))
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'sidecar.deleted', resourceType: 'sidecar', resourceId: sidecarId })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function scaleServiceAction(serviceId: string, environmentId: string, replicas: number) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [row] = await db.select({ target: serviceDeployments, environment: environments })
    .from(serviceDeployments)
    .innerJoin(environments, eq(environments.id, serviceDeployments.environmentId))
    .where(and(eq(serviceDeployments.serviceId, serviceId), eq(serviceDeployments.environmentId, environmentId))).limit(1)
  if (!row || !Number.isInteger(replicas) || replicas < 0) throw new Error('Invalid replica count.')
  if (row.environment.isLocked && access.projectRole !== 'admin') throw new Error('This environment is locked. An administrator must scale it.')

  const pausedReplicas = replicas === 0 ? (row.target.pausedReplicas ?? Math.max(1, row.target.replicas)) : null
  await db.update(serviceDeployments).set({ replicas, pausedReplicas, updatedAt: new Date() }).where(eq(serviceDeployments.id, row.target.id))
  const applied = await applyReplicaCountToCurrentJob({
    orgId: access.org.id,
    serviceId,
    serviceSlug: access.service.slug,
    environmentId,
    namespace: row.environment.trellisNamespace,
    activeJobName: row.target.activeJobName,
    replicas,
  })
  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: replicas === 0 ? 'service.paused' : 'service.scaled',
    resourceType: 'service',
    resourceId: serviceId,
    details: { environmentId, before: row.target.replicas, after: replicas, activeDeploymentUpdated: applied },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
  revalidatePath(`/projects/${access.project.slug}/environments/${row.environment.slug}`)
}

export async function resumeServiceAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [row] = await db.select({ target: serviceDeployments, environment: environments })
    .from(serviceDeployments)
    .innerJoin(environments, eq(environments.id, serviceDeployments.environmentId))
    .where(and(eq(serviceDeployments.serviceId, serviceId), eq(serviceDeployments.environmentId, environmentId))).limit(1)
  if (!row?.target.pausedReplicas) throw new Error('This service is not paused in this environment.')
  if (row.environment.isLocked && access.projectRole !== 'admin') throw new Error('This environment is locked. An administrator must resume it.')

  const replicas = row.target.pausedReplicas
  await db.update(serviceDeployments).set({ replicas, pausedReplicas: null, updatedAt: new Date() }).where(eq(serviceDeployments.id, row.target.id))
  const applied = await applyReplicaCountToCurrentJob({
    orgId: access.org.id,
    serviceId,
    serviceSlug: access.service.slug,
    environmentId,
    namespace: row.environment.trellisNamespace,
    activeJobName: row.target.activeJobName,
    replicas,
  })
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.resumed', resourceType: 'service', resourceId: serviceId, details: { environmentId, replicas, activeDeploymentUpdated: applied } })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
  revalidatePath(`/projects/${access.project.slug}/environments/${row.environment.slug}`)
}

export async function restartServiceAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [row] = await db.select({ target: serviceDeployments, environment: environments })
    .from(serviceDeployments)
    .innerJoin(environments, eq(environments.id, serviceDeployments.environmentId))
    .where(and(eq(serviceDeployments.serviceId, serviceId), eq(serviceDeployments.environmentId, environmentId))).limit(1)
  if (!row) throw new Error('Service deployment target not found.')
  if (row.environment.isLocked && access.projectRole !== 'admin') throw new Error('This environment is locked. An administrator must restart it.')
  const jobName = row.target.activeJobName || access.service.slug
  const client = await getTrellisClient(access.org.id)
  await client.restartJob(jobName, row.environment.trellisNamespace)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.restarted', resourceType: 'service', resourceId: serviceId, details: { environmentId, jobName } })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function stopAllocationAction(serviceId: string, allocationId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const client = await getTrellisClient(access.org.id)
  await client.stopAllocation(allocationId)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'allocation.stopped', resourceType: 'service', resourceId: serviceId, details: { allocationId } })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function execAllocationAction(serviceId: string, allocationId: string, task: string, command: string[]): Promise<TrellisExecResponse> {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const client = await getTrellisClient(access.org.id)
  return client.execAllocation(allocationId, task, command)
}

export async function deleteServiceAction(serviceId: string, projectSlug: string): Promise<{ error?: string }> {
  const access = await requireService(serviceId); if (access.projectRole !== 'admin') return { error: 'Insufficient permissions.' }
  const targets = await db.select({ target: serviceDeployments, environment: environments })
    .from(serviceDeployments)
    .innerJoin(environments, eq(environments.id, serviceDeployments.environmentId))
    .where(eq(serviceDeployments.serviceId, serviceId))
  const client = await getTrellisClient(access.org.id)
  for (const { target, environment } of targets) {
    const names = new Set([
      access.service.slug,
      target.activeJobName,
      `${access.service.slug}-blue`,
      `${access.service.slug}-green`,
      `${access.service.slug}-canary-a`,
      `${access.service.slug}-canary-b`,
    ].filter(Boolean) as string[])
    await Promise.allSettled([...names].map((name) => client.deleteJob(name, environment.trellisNamespace)))
  }
  await db.delete(services).where(eq(services.id, serviceId))
  await Promise.allSettled(targets.map(({ environment }) => syncManagedProxy(access.project.id, environment.id, access.org.id)))
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.deleted', resourceType: 'service', resourceId: serviceId })
  redirect(`/projects/${projectSlug}`)
}
