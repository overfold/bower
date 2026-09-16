'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { baseServiceConfigs, deployments, environments, secretsMetadata, serviceConfigs, services, sidecars } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getUserOrganization } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import type { BowerSecretBinding } from '@/lib/job-builder'
import { recordAudit, requireProject, requireService } from '@/lib/actions/shared'
import { syncManagedProxy } from '@/lib/managed-proxy'
import { createDeploymentSpec, notifyDeployment, recordDeploymentEvent } from '@/lib/deployment-runtime'
import { reconcileProjectDeployments } from '@/lib/deployment-reconciler'
import type { TrellisExecResponse, TrellisJobSpec, TrellisVolume } from '@/types/trellis'

type Trigger = 'manual' | 'webhook' | 'promotion' | 'rollback' | 'auto_rollback'

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

async function executeDeployment(serviceId: string, environmentId: string, triggerType: Trigger, userId?: string | null) {
  const row = await createDeploymentSpec(serviceId, environmentId)
  if (row.environment.isLocked && triggerType === 'webhook') throw new Error('This environment is locked and requires an administrator.')
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
    const steps = [...new Set(row.config.canarySteps as number[])].filter((step) => step > 0 && step <= 100).sort((a, b) => a - b)
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
  try {
    const client = await getTrellisClient(row.project.orgId)
    const plan = await client.planJob(spec, row.environment.trellisNamespace)
    await db.update(deployments).set({ status: 'deploying', planDiff: plan }).where(eq(deployments.id, deployment.id))
    await recordDeploymentEvent(deployment.id, 'deploying', `Applying ${jobName}.`, { plan })
    const result = await client.applyJob(spec, row.environment.trellisNamespace)
    if (result?.revision) await db.update(deployments).set({ trellisRevision: result.revision }).where(eq(deployments.id, deployment.id))
    if (initialCanary) await recordDeploymentEvent(deployment.id, 'canary_step', `Canary started at ${initialCanary.weight}%.`, initialCanary)
    await recordAudit({ orgId: row.project.orgId, userId: userId ?? null, action: `deployment.${triggerType}`, resourceType: 'deployment', resourceId: deployment.id, details: { serviceId, environmentId, image: row.config.image, strategy: row.config.deploymentStrategy } })
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
  const name = String(formData.get('name') ?? '').trim(); const image = String(formData.get('image') ?? '').trim()
  if (!name || !image) return { error: 'Name and image are required.' }
  const slug = slugify(name); const [duplicate] = await db.select().from(services).where(and(eq(services.projectId, project.id), eq(services.slug, slug))).limit(1)
  if (duplicate) return { error: 'A service with this name already exists.' }
  const port = Number(formData.get('port')) || null
  const cpu = Number(formData.get('cpu')) || 100
  const memoryMB = Number(formData.get('memory')) || 128
  const memory = memoryMB * 1048576
  const strategy = (String(formData.get('strategy') ?? '') || 'recreate') as 'rolling' | 'recreate' | 'blue_green' | 'canary'
  const replicas = Number(formData.get('replicas'))
  const [service] = await db.insert(services).values({ projectId: project.id, name, slug }).returning()
  const envs = await db.select().from(environments).where(eq(environments.projectId, project.id))
  const baseReplicas = Number.isInteger(replicas) && replicas >= 0 ? replicas : 1
  await db.insert(baseServiceConfigs).values({
    serviceId: service.id, image, port, replicas: baseReplicas, cpu, memory,
    resourceTier: (envs[0]?.resourceTier ?? 'small') as 'small' | 'medium' | 'large' | 'xl' | 'custom',
    deploymentStrategy: strategy,
    healthCheckType: (port ? 'http' : undefined) as 'http' | 'tcp' | 'script' | undefined,
    healthCheckPath: port ? '/health' : null,
  })
  if (envs.length) await db.insert(serviceConfigs).values(envs.map((env) => ({
    serviceId: service.id, environmentId: env.id, image, port,
    replicas: Number.isInteger(replicas) && replicas >= 0 ? replicas : env.defaultReplicas,
    cpu, memory,
    resourceTier: env.resourceTier as 'small' | 'medium' | 'large' | 'xl' | 'custom',
    deploymentStrategy: strategy,
    healthCheckType: (port ? 'http' : undefined) as 'http' | 'tcp' | 'script' | undefined,
    healthCheckPath: port ? '/health' : null,
  }))).returning()
  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'service.created', resourceType: 'service', resourceId: service.id, details: { before: null, after: { name, image } } })
  redirect(`/projects/${projectSlug}/services/${slug}`)
}

export async function deployServiceAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [env] = await db.select().from(environments).where(eq(environments.id, environmentId)).limit(1)
  if (env?.isLocked && access.projectRole !== 'admin') throw new Error('This environment is locked. An administrator must deploy it.')
  const { deployment } = await executeDeployment(serviceId, environmentId, 'manual', access.user.id)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.deployed', resourceType: 'deployment', resourceId: deployment.id, details: { serviceId, environmentId } })
  revalidatePath(`/projects/${access.project.slug}`)
}

export async function deployServiceFromAutomation(serviceId: string, environmentId: string, image: string, trigger: 'webhook' | 'manual', userId?: string | null) {
  const [row] = await db.select({ environment: environments }).from(serviceConfigs).innerJoin(environments, eq(environments.id, serviceConfigs.environmentId)).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1)
  if (!row) throw new Error('Service environment not found.')
  if (trigger === 'webhook' && row.environment.isLocked) throw new Error('This environment is locked and requires an administrator.')
  await db.update(serviceConfigs).set({ image, updatedAt: new Date() }).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId)))
  return executeDeployment(serviceId, environmentId, trigger, userId)
}

export async function promoteServiceAction(serviceId: string, sourceEnvironmentId: string, targetEnvironmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [source] = await db.select().from(serviceConfigs).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, sourceEnvironmentId))).limit(1)
  const [target] = await db.select().from(serviceConfigs).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, targetEnvironmentId))).limit(1)
  if (!source || !target) throw new Error('Promotion environments were not found.')
  await db.update(serviceConfigs).set({ image: source.image, port: source.port, cpu: source.cpu, memory: source.memory, healthCheckPath: source.healthCheckPath, healthCheckType: source.healthCheckType, healthCheckCommand: source.healthCheckCommand, healthCheckInterval: source.healthCheckInterval, healthCheckTimeout: source.healthCheckTimeout, healthCheckThreshold: source.healthCheckThreshold, deploymentStrategy: source.deploymentStrategy, resourceTier: source.resourceTier, labels: source.labels, command: source.command, volumes: source.volumes, rawConfig: source.rawConfig, cronSchedule: source.cronSchedule, canarySteps: source.canarySteps, updatedAt: new Date() }).where(eq(serviceConfigs.id, target.id))
  const sourceSidecars = await db.select().from(sidecars).where(eq(sidecars.serviceConfigId, source.id)); await db.delete(sidecars).where(eq(sidecars.serviceConfigId, target.id))
  if (sourceSidecars.length) await db.insert(sidecars).values(sourceSidecars.map((sidecar) => ({ serviceConfigId: target.id, name: sidecar.name, image: sidecar.image, cpu: sidecar.cpu, memory: sidecar.memory, port: sidecar.port, envVars: sidecar.envVars, command: sidecar.command })))
  const { deployment } = await executeDeployment(serviceId, targetEnvironmentId, 'promotion', access.user.id)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.promoted', resourceType: 'deployment', resourceId: deployment.id, details: { sourceEnvironmentId, targetEnvironmentId, image: source.image } })
}

export async function rollbackServiceAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [last] = await db.select().from(deployments).where(and(eq(deployments.serviceId, serviceId), eq(deployments.environmentId, environmentId))).orderBy(desc(deployments.createdAt)).limit(1)
  if (!last?.previousJobSpec) throw new Error('No stored previous JobSpec is available.')
  const spec = last.previousJobSpec as TrellisJobSpec; const [config] = await db.select().from(serviceConfigs).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1)
  if (!config) throw new Error('Configuration not found.')
  const replacedJob = config.activeJobName
  const image = spec.task_groups[0]?.tasks[0]?.image
  if (image) await db.update(serviceConfigs).set({ image, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id))
  const client = await getTrellisClient(access.org.id); const plan = await client.planJob(spec, spec.namespace)
  const [deployment] = await db.insert(deployments).values({ serviceId, environmentId, imageBefore: config.image, imageAfter: image || config.image, strategy: config.deploymentStrategy, status: 'deploying', triggeredByUserId: access.user.id, triggerType: 'rollback', planDiff: plan, jobSpec: spec, previousJobSpec: last.jobSpec, trellisJobName: spec.name }).returning()
  await client.applyJob(spec, spec.namespace)
  if (config.deploymentStrategy === 'blue_green' || config.deploymentStrategy === 'canary') {
    await db.update(serviceConfigs).set({ activeJobName: spec.name, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id))
    await syncManagedProxy(access.project.id, environmentId, access.org.id)
    if (replacedJob && replacedJob !== spec.name) await client.deleteJob(replacedJob, spec.namespace).catch(() => undefined)
  }
  await recordDeploymentEvent(deployment.id, 'rollback', 'Re-applied the exact previous JobSpec.')
  await notifyDeployment(await createDeploymentSpec(serviceId, environmentId), 'deploying', access.user.id)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.rollback.requested', resourceType: 'deployment', resourceId: deployment.id, details: { environmentId } })
}

export async function refreshDeploymentStatusesAction(projectId: string) {
  const access = await requireProject(projectId)
  await reconcileProjectDeployments(projectId, access.org.id)
  revalidatePath(`/projects/${access.project.slug}/deployments`)
}

export async function updateServiceConfigAction(serviceId: string, environmentId: string, formData: FormData) {
  const access = await requireService(serviceId); if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [before] = await db.select().from(serviceConfigs).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1); if (!before) throw new Error('Configuration not found.')
  const image = String(formData.get('image') ?? '').trim(); const replicas = Number(formData.get('replicas')); if (!image || !Number.isInteger(replicas) || replicas < 0) throw new Error('A valid image and replica count are required.')
  const tier = String(formData.get('resourceTier') ?? 'custom') as 'small' | 'medium' | 'large' | 'xl' | 'custom'; const tiers = { small: [100, 134217728], medium: [250, 268435456], large: [500, 536870912], xl: [1000, 1073741824] } as const
  const cpu = tier === 'custom' ? Number(formData.get('cpu')) : tiers[tier][0]; const memory = tier === 'custom' ? Number(formData.get('memory')) * 1048576 : tiers[tier][1]
  const secretBindings = jsonField<BowerSecretBinding[]>(formData, 'secretBindings', [])
  const availableSecrets = await db.select({ name: secretsMetadata.trellisSecretName }).from(secretsMetadata).where(eq(secretsMetadata.environmentId, environmentId)); const allowedSecrets = new Set(availableSecrets.map((item) => item.name))
  const invalidSecret = secretBindings.find((binding) => !allowedSecrets.has(binding.name)); if (invalidSecret) throw new Error(`Secret ${invalidSecret.name} does not exist in this environment.`)
  const after = { image, replicas, port: Number(formData.get('port')) || null, resourceTier: tier, cpu, memory, deploymentStrategy: String(formData.get('strategy')) as 'rolling' | 'recreate' | 'blue_green' | 'canary', healthCheckType: (String(formData.get('healthType') ?? '') || null) as 'http' | 'tcp' | 'script' | null, healthCheckPath: String(formData.get('healthPath') ?? '').trim() || null, healthCheckCommand: String(formData.get('healthCommand') ?? '').trim().split(/\s+/).filter(Boolean), healthCheckInterval: Number(formData.get('healthInterval')) || 10, healthCheckTimeout: Number(formData.get('healthTimeout')) || 2, healthCheckThreshold: Number(formData.get('healthThreshold')) || 3, envVars: linesToRecord(String(formData.get('envVars') ?? '')), labels: linesToRecord(String(formData.get('labels') ?? '')), command: String(formData.get('command') ?? '').trim() || null, volumes: jsonField<TrellisVolume[]>(formData, 'volumes', []), secretBindings, rawConfig: jsonField<TrellisJobSpec | null>(formData, 'rawConfig', null), cronSchedule: String(formData.get('cronSchedule') ?? '').trim() || null, autoRollbackSeconds: Math.max(30, Number(formData.get('autoRollbackSeconds')) || 300), canarySteps: jsonField<number[]>(formData, 'canarySteps', [10, 25, 50, 100]), updatedAt: new Date() }
  await db.update(serviceConfigs).set(after).where(eq(serviceConfigs.id, before.id)); await syncManagedProxy(access.project.id, environmentId, access.org.id).catch(() => undefined); await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.config.updated', resourceType: 'service', resourceId: serviceId, details: { before, after } }); revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function upsertSidecarAction(serviceId: string, environmentId: string, formData: FormData) {
  const access = await requireService(serviceId); if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [config] = await db.select().from(serviceConfigs).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1); if (!config) throw new Error('Configuration not found.')
  const id = String(formData.get('id') ?? ''); const values = { serviceConfigId: config.id, name: String(formData.get('name') ?? '').trim(), image: String(formData.get('image') ?? '').trim(), cpu: Number(formData.get('cpu')) || 100, memory: (Number(formData.get('memory')) || 128) * 1048576, port: Number(formData.get('port')) || null, envVars: linesToRecord(String(formData.get('envVars') ?? '')), command: String(formData.get('command') ?? '').trim() || null }
  if (!values.name || !values.image) throw new Error('Sidecar name and image are required.')
  if (id) await db.update(sidecars).set(values).where(and(eq(sidecars.id, id), eq(sidecars.serviceConfigId, config.id))); else await db.insert(sidecars).values(values)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: id ? 'sidecar.updated' : 'sidecar.created', resourceType: 'service', resourceId: serviceId, details: values }); revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function deleteSidecarAction(serviceId: string, sidecarId: string) {
  const access = await requireService(serviceId); if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [config] = await db.select({ id: serviceConfigs.id }).from(sidecars).innerJoin(serviceConfigs, eq(serviceConfigs.id, sidecars.serviceConfigId)).where(and(eq(sidecars.id, sidecarId), eq(serviceConfigs.serviceId, serviceId))).limit(1); if (!config) throw new Error('Sidecar not found.')
  await db.delete(sidecars).where(eq(sidecars.id, sidecarId)); await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'sidecar.deleted', resourceType: 'sidecar', resourceId: sidecarId }); revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function scaleServiceAction(serviceId: string, environmentId: string, replicas: number) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [config] = await db.select().from(serviceConfigs).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1); if (!config || !Number.isInteger(replicas) || replicas < 0) throw new Error('Invalid replica count.')
  await db.update(serviceConfigs).set({ replicas, pausedReplicas: replicas === 0 ? Math.max(1, config.replicas) : null, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id)); await recordAudit({ orgId: access.org.id, userId: access.user.id, action: replicas === 0 ? 'service.paused' : 'service.scaled', resourceType: 'service', resourceId: serviceId, details: { environmentId, before: config.replicas, after: replicas } }); await executeDeployment(serviceId, environmentId, 'manual', access.user.id)
}

export async function resumeServiceAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [config] = await db.select().from(serviceConfigs).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1); if (!config?.pausedReplicas) throw new Error('This service is not paused.')
  await db.update(serviceConfigs).set({ replicas: config.pausedReplicas, pausedReplicas: null, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id)); await executeDeployment(serviceId, environmentId, 'manual', access.user.id); await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.resumed', resourceType: 'service', resourceId: serviceId, details: { environmentId, replicas: config.pausedReplicas } })
}

export async function restartServiceAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [row] = await db.select({ config: serviceConfigs, environment: environments }).from(serviceConfigs).innerJoin(environments, eq(environments.id, serviceConfigs.environmentId)).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1)
  if (!row) throw new Error('Service configuration not found.')
  const jobName = (row.config.activeJobName as string | null) || access.service.slug
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
  const configs = await db.select({ config: serviceConfigs, environment: environments }).from(serviceConfigs).innerJoin(environments, eq(environments.id, serviceConfigs.environmentId)).where(eq(serviceConfigs.serviceId, serviceId))
  const client = await getTrellisClient(access.org.id)
  for (const { config, environment } of configs) {
    const names = new Set([access.service.slug, config.activeJobName, `${access.service.slug}-blue`, `${access.service.slug}-green`, `${access.service.slug}-canary-a`, `${access.service.slug}-canary-b`].filter(Boolean) as string[])
    await Promise.allSettled([...names].map((name) => client.deleteJob(name, environment.trellisNamespace)))
  }
  await db.delete(services).where(eq(services.id, serviceId)); await Promise.allSettled(configs.map(({ environment }) => syncManagedProxy(access.project.id, environment.id, access.org.id)))
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.deleted', resourceType: 'service', resourceId: serviceId }); redirect(`/projects/${projectSlug}`)
}
