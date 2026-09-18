'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { baseServiceConfigs, deployments, environments, serviceConfigs, services } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getProjectEnvironment, getUserOrganization } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { recordAudit, requireProject, requireService } from '@/lib/actions/shared'
import { syncManagedProxy } from '@/lib/managed-proxy'
import { createDeploymentSpec, notifyDeployment, recordDeploymentEvent } from '@/lib/deployment-runtime'
import { reconcileProjectDeployments } from '@/lib/deployment-reconciler'
import type { TrellisExecSession, TrellisExecSessionOutput, TrellisJobSpec } from '@/types/trellis'

type Trigger = 'manual' | 'webhook' | 'rollback' | 'auto_rollback'

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63) || 'service'
}

async function executeDeployment(serviceId: string, environmentId: string, triggerType: Trigger, userId?: string | null) {
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
    await client.applyJob(spec, row.environment.trellisNamespace)
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
  const cpu = Number(formData.get('cpu')) || 100
  const memoryMB = Number(formData.get('memory')) || 128
  const memory = memoryMB * 1048576
  const strategy = (String(formData.get('strategy') ?? '') || 'recreate') as 'rolling' | 'recreate' | 'blue_green' | 'canary'
  const replicas = Number(formData.get('replicas'))
  const [service] = await db.insert(services).values({ projectId: project.id, name, slug }).returning()
  const environment = await getProjectEnvironment(project.id)
  const baseReplicas = Number.isInteger(replicas) && replicas >= 1 ? replicas : 1
  await db.insert(baseServiceConfigs).values({
    serviceId: service.id, image, replicas: baseReplicas, cpu, memory,
    resourceTier: (environment?.resourceTier ?? 'small') as 'small' | 'medium' | 'large' | 'xl' | 'custom',
    deploymentStrategy: strategy,
  })
  if (environment) await db.insert(serviceConfigs).values({
    serviceId: service.id, environmentId: environment.id, image,
    replicas: Number.isInteger(replicas) && replicas >= 1 ? replicas : Math.max(1, environment.defaultReplicas),
    cpu, memory,
    resourceTier: environment.resourceTier as 'small' | 'medium' | 'large' | 'xl' | 'custom',
    deploymentStrategy: strategy,
  }).returning()
  await recordAudit({ orgId: ctx.org.id, userId: user.id, action: 'service.created', resourceType: 'service', resourceId: service.id, details: { before: null, after: { name, image } } })
  revalidatePath(`/projects/${projectSlug}`)
  redirect(`/projects/${projectSlug}/services/${slug}`)
}

export async function deployServiceAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const { deployment } = await executeDeployment(serviceId, environmentId, 'manual', access.user.id)
  await recordAudit({ orgId: access.org.id, userId: access.user.id, action: 'service.deployed', resourceType: 'deployment', resourceId: deployment.id, details: { serviceId, environmentId } })
  revalidatePath(`/projects/${access.project.slug}`)
}

export async function deployServiceFromAutomation(serviceId: string, environmentId: string, image: string, trigger: 'webhook' | 'manual', userId?: string | null) {
  const [row] = await db.select({ config: serviceConfigs }).from(serviceConfigs).innerJoin(environments, eq(environments.id, serviceConfigs.environmentId)).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1)
  if (!row) throw new Error('Service environment not found.')
  const overrides = { ...((row.config.overrides ?? {}) as Record<string, unknown>), image }
  await db.update(serviceConfigs).set({ image, overrides, updatedAt: new Date() }).where(eq(serviceConfigs.id, row.config.id))
  return executeDeployment(serviceId, environmentId, trigger, userId)
}

export async function rollbackServiceAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId); if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')
  const [last] = await db.select().from(deployments).where(and(eq(deployments.serviceId, serviceId), eq(deployments.environmentId, environmentId))).orderBy(desc(deployments.createdAt)).limit(1)
  if (!last?.previousJobSpec) throw new Error('No stored previous JobSpec is available.')
  const spec = last.previousJobSpec as TrellisJobSpec; const [config] = await db.select().from(serviceConfigs).where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1)
  if (!config) throw new Error('Configuration not found.')
  const replacedJob = config.activeJobName
  const image = spec.task_groups[0]?.tasks[0]?.image
  if (image) {
    const overrides = { ...((config.overrides ?? {}) as Record<string, unknown>), image }
    await db.update(serviceConfigs).set({ image, overrides, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id))
  }
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

async function getExecSessionContext(serviceConfigId: string, allocationId?: string) {
  const [row] = await db
    .select({ config: serviceConfigs, environment: environments })
    .from(serviceConfigs)
    .innerJoin(environments, eq(environments.id, serviceConfigs.environmentId))
    .where(eq(serviceConfigs.id, serviceConfigId))
    .limit(1)
  if (!row) throw new Error('Service configuration not found.')

  const access = await requireService(row.config.serviceId)
  if (access.projectRole === 'viewer') throw new Error('Insufficient permissions.')

  const client = await getTrellisClient(access.org.id)
  if (allocationId) {
    const allocations = await client.listAllocations({ namespace: row.environment.trellisNamespace })
    const knownJobs = new Set([access.service.slug, row.config.activeJobName].filter(Boolean) as string[])
    const allocation = allocations.find((item) => (
      item.id === allocationId
      && (item.labels?.['bower/service'] === access.service.slug || knownJobs.has(item.job))
    ))
    if (!allocation) throw new Error('Allocation does not belong to this service environment.')
  }

  return { access, client, namespace: row.environment.trellisNamespace }
}

export async function startExecSessionAction(
  serviceConfigId: string,
  allocationId: string,
  task: string | undefined,
  cols: number,
  rows: number,
): Promise<TrellisExecSession> {
  const { access, client, namespace } = await getExecSessionContext(serviceConfigId, allocationId)
  const session = await client.createExecSession(
    allocationId,
    { task, command: ['/bin/sh'], term: 'xterm-256color', cols, rows },
    namespace,
  )
  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'allocation.terminal.opened',
    resourceType: 'service',
    resourceId: access.service.id,
    details: { allocationId, task },
  })
  return session
}

export async function writeExecSessionAction(
  serviceConfigId: string,
  allocationId: string,
  sessionId: string,
  dataBase64: string,
): Promise<void> {
  const { client, namespace } = await getExecSessionContext(serviceConfigId)
  await client.writeExecSession(allocationId, sessionId, dataBase64, namespace)
}

export async function readExecSessionAction(
  serviceConfigId: string,
  allocationId: string,
  sessionId: string,
  offset: number,
): Promise<TrellisExecSessionOutput> {
  const { client, namespace } = await getExecSessionContext(serviceConfigId)
  return client.readExecSession(allocationId, sessionId, offset, namespace)
}

export async function resizeExecSessionAction(
  serviceConfigId: string,
  allocationId: string,
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  const { client, namespace } = await getExecSessionContext(serviceConfigId)
  await client.resizeExecSession(allocationId, sessionId, cols, rows, namespace)
}

export async function closeExecSessionAction(
  serviceConfigId: string,
  allocationId: string,
  sessionId: string,
): Promise<void> {
  const { client, namespace } = await getExecSessionContext(serviceConfigId)
  await client.closeExecSession(allocationId, sessionId, namespace)
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
