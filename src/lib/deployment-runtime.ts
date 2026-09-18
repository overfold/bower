import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { deploymentEvents, environments, projects, projectVolumes, serviceConfigs, services, users } from '@/db/schema'
import { buildJobSpec, type BowerSecretBinding } from '@/lib/job-builder'
import { sendDeploymentNotifications } from '@/lib/notifications'
import type { TrellisApiAccess, TrellisRuntime, TrellisVolume } from '@/types/trellis'

function buildAttachedVolumes(value: unknown, definitions: Array<{ name: string; hostPath: string }>): TrellisVolume[] {
  if (!Array.isArray(value)) return []
  const byName = new Map(definitions.map((definition) => [definition.name, definition.hostPath]))

  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('A stored volume mount is invalid.')
    const item = entry as Record<string, unknown>
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const containerPath = typeof item.container_path === 'string'
      ? item.container_path.trim()
      : typeof item.path === 'string'
        ? item.path.trim()
        : ''

    const hostPath = byName.get(name) ?? ''

    if (!name || !containerPath) throw new Error('A stored volume mount is incomplete.')
    if (!hostPath) throw new Error(`Volume ${name} is not defined in this environment.`)
    return {
      name,
      host_path: hostPath,
      container_path: containerPath,
      ...(item.read_only === true ? { read_only: true } : {}),
    }
  })
}

export async function createDeploymentSpec(serviceId: string, environmentId: string, jobName?: string, overrides?: { replicas?: number; labels?: Record<string, string> }) {
  const [row] = await db.select({ config: serviceConfigs, service: services, environment: environments, project: projects })
    .from(serviceConfigs)
    .innerJoin(services, eq(services.id, serviceConfigs.serviceId))
    .innerJoin(environments, eq(environments.id, serviceConfigs.environmentId))
    .innerJoin(projects, eq(projects.id, services.projectId))
    .where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1)
  if (!row) throw new Error('Service configuration was not found.')
  const definitions = await db.select({ name: projectVolumes.name, hostPath: projectVolumes.hostPath })
    .from(projectVolumes)
    .where(and(eq(projectVolumes.projectId, row.project.id), eq(projectVolumes.environmentId, environmentId)))

  const runtime: TrellisRuntime = row.config.runtime === 'runsc' ? 'runsc' : 'runc'
  const apiAccess: TrellisApiAccess | undefined =
    (row.config.apiAccessScope === 'namespace' || row.config.apiAccessScope === 'cluster') &&
    (row.config.apiAccessLevel === 'read' || row.config.apiAccessLevel === 'write')
      ? { scope: row.config.apiAccessScope, access: row.config.apiAccessLevel }
      : undefined

  const spec = buildJobSpec({
    name: jobName || row.service.slug, serviceLabel: row.service.slug, namespace: row.environment.trellisNamespace,
    image: row.config.image, replicas: overrides?.replicas ?? row.config.replicas,
    cpu: row.config.cpu, memory: row.config.memory, healthCheckPath: row.config.healthCheckPath ?? undefined,
    healthCheckType: row.config.healthCheckType ?? undefined, healthCheckPort: row.config.healthCheckPort ?? undefined,
    healthCheckCommand: row.config.healthCheckCommand as string[],
    healthCheckInterval: row.config.healthCheckInterval, healthCheckTimeout: row.config.healthCheckTimeout,
    healthCheckThreshold: row.config.healthCheckThreshold, deploymentStrategy: row.config.deploymentStrategy,
    envVars: row.config.envVars as Record<string, string>, labels: { ...(row.config.labels as Record<string, string>), ...overrides?.labels },
    secrets: [...Object.entries(row.environment.envVars as Record<string, string>).map(([env, name]) => ({ name, target: 'env' as const, env })), ...(row.config.secretBindings as BowerSecretBinding[])],
    volumes: buildAttachedVolumes(row.config.volumes, definitions),
    runtime,
    apiAccess,
  })
  return { ...row, spec }
}

export async function recordDeploymentEvent(deploymentId: string, type: string, message: string, details: Record<string, unknown> = {}) {
  await db.insert(deploymentEvents).values({ deploymentId, type, message, details })
}

export async function notifyDeployment(row: Awaited<ReturnType<typeof createDeploymentSpec>>, status: string, userId?: string | null) {
  const [user] = userId ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1) : []
  await sendDeploymentNotifications(row.project.id, { service: row.service.name, environment: row.environment.name, image: row.config.image, status, user: user?.name || user?.email || 'automation', timestamp: new Date().toISOString() })
}
