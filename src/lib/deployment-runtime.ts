import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { deploymentEvents, environments, projects, serviceConfigs, services, sidecars, users } from '@/db/schema'
import { serviceAdvancedSettings } from '@/db/service-advanced-schema'
import { buildJobSpec, type BowerSecretBinding, type BowerSidecar } from '@/lib/job-builder'
import { sendDeploymentNotifications } from '@/lib/notifications'
import type { TrellisApiAccess, TrellisJobSpec, TrellisRuntime, TrellisVolume } from '@/types/trellis'

function normalizeStoredVolumes(value: unknown): TrellisVolume[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const item = entry as Record<string, unknown>
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const containerPath = typeof item.container_path === 'string'
      ? item.container_path.trim()
      : typeof item.path === 'string'
        ? item.path.trim()
        : ''

    let hostPath = typeof item.host_path === 'string' ? item.host_path.trim() : ''
    if (!hostPath && typeof item.host_volume === 'string' && item.host_volume.trim()) {
      const legacy = item.host_volume.trim()
      hostPath = legacy.startsWith('/') || legacy.startsWith('@/') ? legacy : `@/${legacy}`
    }
    if (!hostPath && name) hostPath = `@/${name}`

    if (!name || !hostPath || !containerPath) return []
    return [{
      name,
      host_path: hostPath,
      container_path: containerPath,
      ...(item.read_only === true ? { read_only: true } : {}),
    }]
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
  const [attached, advanced] = await Promise.all([
    db.select().from(sidecars).where(eq(sidecars.serviceConfigId, row.config.id)),
    db.select().from(serviceAdvancedSettings).where(eq(serviceAdvancedSettings.serviceConfigId, row.config.id)).limit(1).then((items) => items[0] ?? null),
  ])

  const runtime: TrellisRuntime = advanced?.runtime === 'runsc' ? 'runsc' : 'runc'
  const apiAccess: TrellisApiAccess | undefined =
    (advanced?.apiAccessScope === 'namespace' || advanced?.apiAccessScope === 'cluster') &&
    (advanced?.apiAccessLevel === 'read' || advanced?.apiAccessLevel === 'write')
      ? { scope: advanced.apiAccessScope, access: advanced.apiAccessLevel }
      : undefined

  const spec = buildJobSpec({
    name: jobName || row.service.slug, serviceLabel: row.service.slug, namespace: row.environment.trellisNamespace,
    image: row.config.image, port: row.config.port ?? undefined, replicas: overrides?.replicas ?? row.config.replicas,
    cpu: row.config.cpu, memory: row.config.memory, healthCheckPath: row.config.healthCheckPath ?? undefined,
    healthCheckType: row.config.healthCheckType ?? undefined, healthCheckCommand: row.config.healthCheckCommand as string[],
    healthCheckInterval: row.config.healthCheckInterval, healthCheckTimeout: row.config.healthCheckTimeout,
    healthCheckThreshold: row.config.healthCheckThreshold, deploymentStrategy: row.config.deploymentStrategy,
    envVars: row.config.envVars as Record<string, string>, labels: { ...(row.config.labels as Record<string, string>), ...overrides?.labels },
    command: row.config.command ?? undefined,
    secrets: [...Object.entries(row.environment.envVars as Record<string, string>).map(([env, name]) => ({ name, target: 'env' as const, env })), ...(row.config.secretBindings as BowerSecretBinding[])],
    volumes: normalizeStoredVolumes(row.config.volumes),
    sidecars: attached.map((item) => ({ name: item.name, image: item.image, cpu: item.cpu, memory: item.memory, port: item.port ?? undefined, envVars: item.envVars as Record<string, string>, command: item.command ?? undefined })) as BowerSidecar[],
    runtime,
    apiAccess,
    rawConfig: row.config.rawConfig as TrellisJobSpec | undefined,
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
