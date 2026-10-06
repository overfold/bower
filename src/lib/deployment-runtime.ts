import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { deploymentEvents, environments, projects, projectVolumes, serviceConfigs, services, users } from '@/db/schema'
import { buildJobSpec } from '@/lib/job-builder'
import { sendDeploymentNotifications } from '@/lib/notifications'
import type { TrellisApiAccess, TrellisRuntime, TrellisVolume } from '@/types/trellis'
import { positiveInteger } from '@/lib/service-config-input'
import { validateSecretBindings, validateVolumeMounts } from '@/lib/workload-input'
import { assertStoredHostPathAllowed, assertStoredWorkloadApiAccessAllowed } from '@/lib/workload-policy'

function buildAttachedVolumes(value: unknown, definitions: Array<{ name: string; hostPath: string }>): TrellisVolume[] {
  const byName = new Map(definitions.map((definition) => [definition.name, definition.hostPath]))

  return validateVolumeMounts(value).map((item) => {
    const hostPath = byName.get(item.name) ?? ''
    if (!hostPath) throw new Error(`Volume ${item.name} is not defined in this environment.`)
    assertStoredHostPathAllowed(hostPath)
    return {
      name: item.name,
      host_path: hostPath,
      container_path: item.container_path,
      ...(item.read_only === true ? { read_only: true } : {}),
    }
  })
}

export async function createDeploymentSpec(serviceId: string, environmentId: string, jobName?: string, overrides?: { replicas?: number; labels?: Record<string, string> }) {
  const [row] = await db.select({ config: serviceConfigs, service: services, environment: environments, project: projects })
    .from(serviceConfigs)
    .innerJoin(services, eq(services.id, serviceConfigs.serviceId))
    .innerJoin(environments, and(eq(environments.id, serviceConfigs.environmentId), eq(environments.projectId, services.projectId)))
    .innerJoin(projects, eq(projects.id, services.projectId))
    .where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId))).limit(1)
  if (!row) throw new Error('Service configuration was not found.')
  const definitions = await db.select({ name: projectVolumes.name, hostPath: projectVolumes.hostPath })
    .from(projectVolumes)
    .where(and(eq(projectVolumes.projectId, row.project.id), eq(projectVolumes.environmentId, environmentId)))

  const runtime: TrellisRuntime = row.config.runtime === 'runsc' ? 'runsc' : 'runc'
  const apiAccess: TrellisApiAccess | undefined =
    row.config.apiAccessScope === 'cluster' &&
    (row.config.apiAccessLevel === 'read' || row.config.apiAccessLevel === 'write')
      ? { scope: row.config.apiAccessScope, access: row.config.apiAccessLevel }
      : undefined
  assertStoredWorkloadApiAccessAllowed(apiAccess)
  const replicas = positiveInteger(overrides?.replicas ?? row.config.replicas, 'Stored replicas')
  const cpu = positiveInteger(row.config.cpu, 'Stored CPU')
  const memory = positiveInteger(row.config.memory, 'Stored memory')
  const environmentSecrets = Object.entries(row.environment.envVars as Record<string, string>)
    .map(([env, name]) => ({ name, target: 'env' as const, env }))
  const secrets = validateSecretBindings([...environmentSecrets, ...validateSecretBindings(row.config.secretBindings)])

  const spec = buildJobSpec({
    name: jobName || row.service.slug, serviceLabel: row.service.slug, namespace: row.environment.trellisNamespace,
    image: row.config.image, replicas,
    cpu, memory, healthCheckPath: row.config.healthCheckPath ?? undefined,
    healthCheckType: row.config.healthCheckType ?? undefined, healthCheckPort: row.config.healthCheckPort ?? undefined,
    healthCheckCommand: row.config.healthCheckCommand as string[],
    healthCheckInterval: row.config.healthCheckInterval, healthCheckTimeout: row.config.healthCheckTimeout,
    healthCheckThreshold: row.config.healthCheckThreshold, deploymentStrategy: row.config.deploymentStrategy,
    envVars: row.config.envVars as Record<string, string>, labels: { ...(row.config.labels as Record<string, string>), ...overrides?.labels },
    secrets,
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
