'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { baseServiceConfigs, serviceConfigs } from '@/db/schema'
import { getBaseServiceConfig } from '@/lib/queries'
import { recordAudit, requireService } from '@/lib/actions/shared'
import type { BowerSecretBinding } from '@/lib/job-builder'

type VolumeMount = { name: string; container_path: string; read_only?: boolean }

const TIERS = { small: [100, 134217728], medium: [250, 268435456], large: [500, 536870912], xl: [1000, 1073741824] } as const

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

function parseConfig(formData: FormData) {
  const image = String(formData.get('image') ?? '').trim()
  const replicas = Number(formData.get('replicas'))
  if (!image || !Number.isInteger(replicas) || replicas < 1) throw new Error('A valid image and replica count of at least one are required.')
  const tier = String(formData.get('resourceTier') ?? 'custom') as 'small' | 'medium' | 'large' | 'xl' | 'custom'
  const cpu = tier === 'custom' ? Number(formData.get('cpu')) : TIERS[tier][0]
  const memory = tier === 'custom' ? Number(formData.get('memory')) * 1048576 : TIERS[tier][1]
  if (!Number.isFinite(cpu) || cpu < 0 || !Number.isFinite(memory) || memory < 0) throw new Error('CPU and memory must be non-negative numbers.')
  const healthCheckType = (String(formData.get('healthType') ?? '') || null) as 'http' | 'tcp' | 'script' | null
  const healthCheckPort = Number(formData.get('healthPort')) || null
  const healthCheckCommand = String(formData.get('healthCommand') ?? '').trim().split(/\s+/).filter(Boolean)
  if ((healthCheckType === 'http' || healthCheckType === 'tcp') && (!healthCheckPort || healthCheckPort > 65_535)) throw new Error('HTTP and TCP health checks require a valid port.')
  if (healthCheckType === 'script' && healthCheckCommand.length === 0) throw new Error('Script health checks require a command.')
  return {
    image, replicas, resourceTier: tier, cpu, memory,
    deploymentStrategy: String(formData.get('strategy')) as 'rolling' | 'recreate' | 'blue_green' | 'canary',
    healthCheckType,
    healthCheckPort,
    healthCheckPath: String(formData.get('healthPath') ?? '').trim() || null,
    healthCheckCommand,
    healthCheckInterval: Number(formData.get('healthInterval')) || 10,
    healthCheckTimeout: Number(formData.get('healthTimeout')) || 2,
    healthCheckThreshold: Number(formData.get('healthThreshold')) || 3,
    envVars: linesToRecord(String(formData.get('envVars') ?? '')),
    labels: linesToRecord(String(formData.get('labels') ?? '')),
    volumes: jsonField<VolumeMount[]>(formData, 'volumes', []),
    secretBindings: jsonField<BowerSecretBinding[]>(formData, 'secretBindings', []),
    autoRollbackSeconds: Math.max(30, Number(formData.get('autoRollbackSeconds')) || 300),
    canarySteps: jsonField<number[]>(formData, 'canarySteps', [10, 25, 50, 100]),
    updatedAt: new Date(),
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

const ADVANCED_OVERRIDE_FIELDS = ['runtime', 'apiAccessScope', 'apiAccessLevel'] as const

function preserveAdvancedOverrides(overrides: unknown) {
  const existing = (overrides ?? {}) as Record<string, unknown>
  const preserved: Record<string, unknown> = {}
  for (const field of ADVANCED_OVERRIDE_FIELDS) {
    if (field in existing) preserved[field] = existing[field]
  }
  return preserved
}

export async function upsertBaseServiceConfigAction(serviceId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')

  const values = parseConfig(formData)
  const before = await getBaseServiceConfig(serviceId)

  await db.insert(baseServiceConfigs)
    .values({ serviceId, ...values })
    .onConflictDoUpdate({ target: baseServiceConfigs.serviceId, set: values })

  const allEnvConfigs = await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId))
  for (const envConfig of allEnvConfigs) {
    const overrides = (envConfig.overrides ?? {}) as Record<string, unknown>
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    for (const [key, val] of Object.entries(values) as Array<[string, unknown]>) {
      if (key === 'updatedAt') continue
      if (!(key in overrides)) {
        patch[key] = val
      }
    }
    if (Object.keys(patch).length > 1) {
      await db.update(serviceConfigs).set(patch).where(eq(serviceConfigs.id, envConfig.id))
    }
  }

  await recordAudit({
    orgId: access.org.id, userId: access.user.id,
    action: before ? 'service.base_config.updated' : 'service.base_config.created',
    resourceType: 'service', resourceId: serviceId,
    details: { before, after: values },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function updateServiceConfigOverridesAction(serviceId: string, environmentId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')

  const [envConfig] = await db.select().from(serviceConfigs)
    .where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId)))
    .limit(1)
  if (!envConfig) throw new Error('Configuration not found.')

  const desired = parseConfig(formData)
  const base = await getBaseServiceConfig(serviceId)

  const newOverrides: Record<string, unknown> = preserveAdvancedOverrides(envConfig.overrides)
  if (base) {
    const baseValues = parseConfig(formDataFromBase(base))
    for (const [key, val] of Object.entries(desired) as Array<[string, unknown]>) {
      if (key === 'updatedAt') continue
      const baseVal = (baseValues as Record<string, unknown>)[key]
      if (!deepEqual(val, baseVal)) {
        newOverrides[key] = val
      }
    }
  }

  await db.update(serviceConfigs)
    .set({ ...desired, overrides: Object.keys(newOverrides).length > 0 ? newOverrides : null })
    .where(eq(serviceConfigs.id, envConfig.id))

  await recordAudit({
    orgId: access.org.id, userId: access.user.id,
    action: 'service.config.updated',
    resourceType: 'service', resourceId: serviceId,
    details: { environmentId, overriddenFields: Object.keys(newOverrides) },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

export async function resetServiceConfigOverridesAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')

  const base = await getBaseServiceConfig(serviceId)
  if (!base) throw new Error('No base configuration to reset to.')

  const [envConfig] = await db.select().from(serviceConfigs)
    .where(and(eq(serviceConfigs.serviceId, serviceId), eq(serviceConfigs.environmentId, environmentId)))
    .limit(1)
  if (!envConfig) throw new Error('Configuration not found.')

  const preservedOverrides = preserveAdvancedOverrides(envConfig.overrides)

  await db.update(serviceConfigs).set({
    image: base.image,
    replicas: base.replicas,
    cpu: base.cpu,
    memory: base.memory,
    healthCheckPath: base.healthCheckPath,
    healthCheckType: base.healthCheckType,
    healthCheckPort: base.healthCheckPort,
    healthCheckCommand: base.healthCheckCommand,
    healthCheckInterval: base.healthCheckInterval,
    healthCheckTimeout: base.healthCheckTimeout,
    healthCheckThreshold: base.healthCheckThreshold,
    deploymentStrategy: base.deploymentStrategy,
    resourceTier: base.resourceTier,
    envVars: base.envVars,
    labels: base.labels,
    volumes: base.volumes,
    secretBindings: base.secretBindings,
    autoRollbackSeconds: base.autoRollbackSeconds,
    canarySteps: base.canarySteps,
    overrides: Object.keys(preservedOverrides).length > 0 ? preservedOverrides : null,
    updatedAt: new Date(),
  }).where(eq(serviceConfigs.id, envConfig.id))

  await recordAudit({
    orgId: access.org.id, userId: access.user.id,
    action: 'service.config.reset_to_base',
    resourceType: 'service', resourceId: serviceId,
    details: { environmentId },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}

function formDataFromBase(base: Awaited<ReturnType<typeof getBaseServiceConfig>>) {
  if (!base) return new FormData()
  const fd = new FormData()
  fd.set('image', base.image)
  fd.set('replicas', String(base.replicas))
  fd.set('resourceTier', base.resourceTier)
  fd.set('cpu', String(base.cpu))
  fd.set('memory', String(Math.round(base.memory / 1048576)))
  fd.set('strategy', base.deploymentStrategy)
  fd.set('healthType', base.healthCheckType ?? '')
  fd.set('healthPort', base.healthCheckPort ? String(base.healthCheckPort) : '')
  fd.set('healthPath', base.healthCheckPath ?? '')
  fd.set('healthCommand', Array.isArray(base.healthCheckCommand) ? (base.healthCheckCommand as string[]).join(' ') : '')
  fd.set('healthInterval', String(base.healthCheckInterval))
  fd.set('healthTimeout', String(base.healthCheckTimeout))
  fd.set('healthThreshold', String(base.healthCheckThreshold))
  fd.set('envVars', Object.entries(base.envVars as Record<string, string> ?? {}).map(([k, v]) => `${k}=${v}`).join('\n'))
  fd.set('labels', Object.entries(base.labels as Record<string, string> ?? {}).map(([k, v]) => `${k}=${v}`).join('\n'))
  fd.set('volumes', JSON.stringify(base.volumes ?? []))
  fd.set('secretBindings', JSON.stringify(base.secretBindings ?? []))
  fd.set('autoRollbackSeconds', String(base.autoRollbackSeconds))
  fd.set('canarySteps', JSON.stringify(base.canarySteps ?? [10, 25, 50, 100]))
  return fd
}
