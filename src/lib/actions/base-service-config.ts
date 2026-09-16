'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { baseServiceConfigs, serviceConfigs } from '@/db/schema'
import { getBaseServiceConfig } from '@/lib/queries'
import { recordAudit, requireService } from '@/lib/actions/shared'
import type { BowerSecretBinding } from '@/lib/job-builder'
import type { TrellisJobSpec, TrellisVolume } from '@/types/trellis'

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
  if (!image || !Number.isInteger(replicas) || replicas < 0) throw new Error('A valid image and replica count are required.')
  const tier = String(formData.get('resourceTier') ?? 'custom') as 'small' | 'medium' | 'large' | 'xl' | 'custom'
  const cpu = tier === 'custom' ? Number(formData.get('cpu')) : TIERS[tier][0]
  const memory = tier === 'custom' ? Number(formData.get('memory')) * 1048576 : TIERS[tier][1]
  return {
    image, replicas, resourceTier: tier, cpu, memory,
    port: Number(formData.get('port')) || null,
    deploymentStrategy: String(formData.get('strategy')) as 'rolling' | 'recreate' | 'blue_green' | 'canary',
    healthCheckType: (String(formData.get('healthType') ?? '') || null) as 'http' | 'tcp' | 'script' | null,
    healthCheckPath: String(formData.get('healthPath') ?? '').trim() || null,
    healthCheckCommand: String(formData.get('healthCommand') ?? '').trim().split(/\s+/).filter(Boolean),
    healthCheckInterval: Number(formData.get('healthInterval')) || 10,
    healthCheckTimeout: Number(formData.get('healthTimeout')) || 2,
    healthCheckThreshold: Number(formData.get('healthThreshold')) || 3,
    envVars: linesToRecord(String(formData.get('envVars') ?? '')),
    labels: linesToRecord(String(formData.get('labels') ?? '')),
    command: String(formData.get('command') ?? '').trim() || null,
    volumes: jsonField<TrellisVolume[]>(formData, 'volumes', []),
    secretBindings: jsonField<BowerSecretBinding[]>(formData, 'secretBindings', []),
    rawConfig: jsonField<TrellisJobSpec | null>(formData, 'rawConfig', null),
    cronSchedule: String(formData.get('cronSchedule') ?? '').trim() || null,
    autoRollbackSeconds: Math.max(30, Number(formData.get('autoRollbackSeconds')) || 300),
    canarySteps: jsonField<number[]>(formData, 'canarySteps', [10, 25, 50, 100]),
    updatedAt: new Date(),
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
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

  let newOverrides: Record<string, unknown> = {}
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

  await db.update(serviceConfigs).set({
    image: base.image,
    port: base.port,
    replicas: base.replicas,
    cpu: base.cpu,
    memory: base.memory,
    healthCheckPath: base.healthCheckPath,
    healthCheckType: base.healthCheckType,
    healthCheckCommand: base.healthCheckCommand,
    healthCheckInterval: base.healthCheckInterval,
    healthCheckTimeout: base.healthCheckTimeout,
    healthCheckThreshold: base.healthCheckThreshold,
    deploymentStrategy: base.deploymentStrategy,
    resourceTier: base.resourceTier,
    envVars: base.envVars,
    labels: base.labels,
    command: base.command,
    volumes: base.volumes,
    secretBindings: base.secretBindings,
    rawConfig: base.rawConfig,
    cronSchedule: base.cronSchedule,
    autoRollbackSeconds: base.autoRollbackSeconds,
    canarySteps: base.canarySteps,
    overrides: null,
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

export async function updateBaseServiceVolumesAction(serviceId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')

  const base = await getBaseServiceConfig(serviceId)
  if (!base) throw new Error('No base configuration exists. Set a base configuration on the Overview tab first.')

  const volumes = jsonField<TrellisVolume[]>(formData, 'volumes', [])

  await db.update(baseServiceConfigs).set({ volumes, updatedAt: new Date() }).where(eq(baseServiceConfigs.serviceId, serviceId))

  const allEnvConfigs = await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId))
  for (const envConfig of allEnvConfigs) {
    const overrides = (envConfig.overrides ?? {}) as Record<string, unknown>
    if (!('volumes' in overrides)) {
      await db.update(serviceConfigs).set({ volumes, updatedAt: new Date() }).where(eq(serviceConfigs.id, envConfig.id))
    }
  }

  await recordAudit({
    orgId: access.org.id, userId: access.user.id,
    action: 'service.base_config.volumes_updated',
    resourceType: 'service', resourceId: serviceId,
    details: { volumeCount: volumes.length },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}/volumes`)
}

function formDataFromBase(base: Awaited<ReturnType<typeof getBaseServiceConfig>>) {
  if (!base) return new FormData()
  const fd = new FormData()
  fd.set('image', base.image)
  fd.set('replicas', String(base.replicas))
  fd.set('resourceTier', base.resourceTier)
  fd.set('cpu', String(base.cpu))
  fd.set('memory', String(Math.round(base.memory / 1048576)))
  fd.set('port', base.port ? String(base.port) : '')
  fd.set('strategy', base.deploymentStrategy)
  fd.set('healthType', base.healthCheckType ?? '')
  fd.set('healthPath', base.healthCheckPath ?? '')
  fd.set('healthCommand', Array.isArray(base.healthCheckCommand) ? (base.healthCheckCommand as string[]).join(' ') : '')
  fd.set('healthInterval', String(base.healthCheckInterval))
  fd.set('healthTimeout', String(base.healthCheckTimeout))
  fd.set('healthThreshold', String(base.healthCheckThreshold))
  fd.set('envVars', Object.entries(base.envVars as Record<string, string> ?? {}).map(([k, v]) => `${k}=${v}`).join('\n'))
  fd.set('labels', Object.entries(base.labels as Record<string, string> ?? {}).map(([k, v]) => `${k}=${v}`).join('\n'))
  fd.set('command', base.command ?? '')
  fd.set('volumes', JSON.stringify(base.volumes ?? []))
  fd.set('secretBindings', JSON.stringify(base.secretBindings ?? []))
  fd.set('rawConfig', base.rawConfig ? JSON.stringify(base.rawConfig) : '')
  fd.set('cronSchedule', base.cronSchedule ?? '')
  fd.set('autoRollbackSeconds', String(base.autoRollbackSeconds))
  fd.set('canarySteps', JSON.stringify(base.canarySteps ?? [10, 25, 50, 100]))
  return fd
}
