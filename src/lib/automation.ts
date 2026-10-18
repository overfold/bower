import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { deployments, environments, projects, serviceConfigs, services } from '@/db/schema'
import { authenticateApiKey, authenticateApiKeyToken, authorizeApiKeyProject } from '@/lib/api-auth'
import { deployServiceFromAutomation, restartServiceFromAutomation, rollbackServiceFromAutomation } from '@/lib/actions/services'
import { getTrellisClient } from '@/lib/trellis-instance'
import { allocationBelongsToService } from '@/lib/trellis-runtime'

export class AutomationError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export type ApplicationRead =
  | { operation: 'projects' }
  | { operation: 'environments'; projectId: string }
  | { operation: 'services'; projectId: string }
  | { operation: 'deployments'; serviceId: string; environmentId: string }
  | { operation: 'allocations'; serviceId: string; environmentId: string }
  | { operation: 'logs'; serviceId: string; environmentId: string; allocationId: string; task?: string }
  | { operation: 'metrics'; serviceId: string; environmentId: string; allocationId: string }

export type ApplicationDeploy = { serviceId: string; environmentId: string; image: string }
export type ApplicationRecovery =
  | { operation: 'restart'; serviceId: string; environmentId: string }
  | { operation: 'rollback'; serviceId: string; environmentId: string; targetDeploymentId: string }

export function isResourceId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/** Shared entry point for HTTP and future CLI/MCP adapters. Never accepts a caller-supplied actor. */
export async function readApplication(header: string | null, input: ApplicationRead) {
  const key = await authenticateApiKeyToken(header)
  if (!key) throw new AutomationError(401, 'Unauthorized.')
  if (!key.scopes.includes('read')) throw new AutomationError(403, 'Read scope required.')
  if (input.operation === 'projects') {
    const candidates = await db.select({ id: projects.id, name: projects.name, slug: projects.slug }).from(projects)
      .where(and(eq(projects.orgId, key.orgId), key.projectId ? eq(projects.id, key.projectId) : undefined)).orderBy(asc(projects.id)).limit(100)
    const visible = []
    for (const project of candidates) {
      if (await authorizeApiKeyProject(key, project.id, 'read', key.environmentId ?? undefined)) visible.push(project)
    }
    return { projects: visible }
  }
  if (input.operation === 'environments' || input.operation === 'services') {
    if (!isResourceId(input.projectId)) throw new AutomationError(400, 'Invalid projectId.')
    const access = await authorizeApiKeyProject(key, input.projectId, 'read', key.environmentId ?? undefined)
    if (!access) throw new AutomationError(403, 'Project access denied.')
    if (input.operation === 'environments') {
      return { environments: await db.select({ id: environments.id, projectId: environments.projectId, name: environments.name, slug: environments.slug }).from(environments)
        .where(and(eq(environments.projectId, input.projectId), key.environmentId ? eq(environments.id, key.environmentId) : undefined)).orderBy(asc(environments.id)).limit(100) }
    }
    return { services: await db.select({ id: services.id, projectId: services.projectId, name: services.name, slug: services.slug }).from(services)
      .where(eq(services.projectId, input.projectId)).orderBy(asc(services.id)).limit(100) }
  }
  if (!isResourceId(input.serviceId) || !isResourceId(input.environmentId)) throw new AutomationError(400, 'Invalid serviceId or environmentId.')
  const access = await authenticateApiKey(header, input.serviceId, input.environmentId, 'read')
  if (!access) throw new AutomationError(403, 'Service environment access denied.')
  if (input.operation === 'deployments') {
    // Explicit projection: stored JobSpecs, plans and environment values can contain secrets.
    const rows = await db.select({ id: deployments.id, serviceId: deployments.serviceId, environmentId: deployments.environmentId,
      image: deployments.imageAfter, status: deployments.status, strategy: deployments.strategy, trigger: deployments.triggerType,
      startedAt: deployments.startedAt, completedAt: deployments.completedAt }).from(deployments)
      .where(and(eq(deployments.serviceId, input.serviceId), eq(deployments.environmentId, input.environmentId)))
      .orderBy(desc(deployments.createdAt), desc(deployments.id)).limit(20)
    return { deployments: rows.map((row) => ({ ...row, startedAt: row.startedAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null })) }
  }
  const [row] = await db.select({ config: serviceConfigs, environment: environments }).from(serviceConfigs)
    .innerJoin(environments, eq(environments.id, serviceConfigs.environmentId))
    .where(and(eq(serviceConfigs.serviceId, input.serviceId), eq(serviceConfigs.environmentId, input.environmentId), eq(environments.projectId, access.project.id))).limit(1)
  if (!row) throw new AutomationError(404, 'Service environment not found.')
  const client = await getTrellisClient(key.orgId)
  const allocations = (await client.listAllocations({ namespace: row.environment.trellisNamespace }))
    .filter((allocation) => allocationBelongsToService(allocation, row.environment.trellisNamespace, access.service.slug, [access.service.slug, row.config.activeJobName]))
  if (input.operation === 'allocations') {
    return { allocations: allocations.map((allocation) => ({ id: allocation.id, phase: allocation.phase, health: allocation.health,
      tasks: allocation.tasks ?? [], createdAt: allocation.created_at, lastTransitionAt: allocation.last_transition_at })) }
  }
  if (!input.allocationId || input.allocationId.length > 256) throw new AutomationError(400, 'Invalid allocationId.')
  const allocation = allocations.find((item) => item.id === input.allocationId)
  if (!allocation) throw new AutomationError(404, 'Allocation not found.')
  if (input.operation === 'metrics') {
    return { metrics: (await client.getAllocationMetrics(allocation.id, allocation.namespace)).map((metric) => ({
      allocationId: allocation.id, task: metric.task, cpuUsageNanoseconds: metric.cpu_usage_nanoseconds,
      memoryUsageBytes: metric.memory_usage_bytes, collectedAt: metric.collected_at,
    })) }
  }
  if (input.task !== undefined && (!input.task || input.task.length > 256)) throw new AutomationError(400, 'Invalid task.')
  return { logs: await client.getAllocationLogs(allocation.id, input.task, allocation.namespace, 200) }
}

export async function deployApplication(header: string | null, input: ApplicationDeploy) {
  if (!await authenticateApiKeyToken(header)) throw new AutomationError(401, 'Unauthorized.')
  if (!input || !isResourceId(input.serviceId) || !isResourceId(input.environmentId) || typeof input.image !== 'string' || !input.image.trim() || input.image.length > 2048) {
    throw new AutomationError(400, 'serviceId, environmentId, and image are required.')
  }
  const access = await authenticateApiKey(header, input.serviceId, input.environmentId)
  if (!access) throw new AutomationError(403, 'Service environment deploy access denied.')
  const result = await deployServiceFromAutomation(input.serviceId, input.environmentId, input.image, 'manual', access.actor)
  return { accepted: true as const, deploymentId: result.deployment.id }
}

export async function recoverApplication(header: string | null, input: ApplicationRecovery) {
  if (!await authenticateApiKeyToken(header)) throw new AutomationError(401, 'Unauthorized.')
  if (!input || (input.operation !== 'restart' && input.operation !== 'rollback') || !isResourceId(input.serviceId) || !isResourceId(input.environmentId)) {
    throw new AutomationError(400, 'operation (restart or rollback), serviceId, and environmentId are required.')
  }
  if (input.operation === 'rollback' && !isResourceId(input.targetDeploymentId)) throw new AutomationError(400, 'A targetDeploymentId is required for rollback.')
  const access = await authenticateApiKey(header, input.serviceId, input.environmentId, input.operation)
  if (!access) throw new AutomationError(403, 'Service environment recovery access denied.')
  // The exported server actions also authenticate internally; they never accept a supplied actor.
  if (input.operation === 'restart') {
    await restartServiceFromAutomation(header, input.serviceId, input.environmentId)
    return { accepted: true as const, operation: 'restart' as const }
  }
  const result = await rollbackServiceFromAutomation(header, input.serviceId, input.environmentId, input.targetDeploymentId)
  return { accepted: true as const, operation: 'rollback' as const, deploymentId: result.deploymentId }
}

export type ApplicationReadResult = Awaited<ReturnType<typeof readApplication>>
export type ApplicationDeployResult = Awaited<ReturnType<typeof deployApplication>>
export type ApplicationRecoveryResult = Awaited<ReturnType<typeof recoverApplication>>
