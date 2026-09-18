'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { baseServiceConfigs, environments, secretsMetadata, serviceConfigs } from '@/db/schema'
import { getBaseServiceConfig } from '@/lib/queries'
import { recordAudit, requireService } from '@/lib/actions/shared'
import type { BowerSecretBinding } from '@/lib/job-builder'
import type { TrellisApiAccess, TrellisRuntime, TrellisVolume } from '@/types/trellis'

function parseLines(value: string) {
  const result: Record<string, string> = {}
  for (const line of value.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const split = line.indexOf('=')
    if (split < 1) throw new Error(`Invalid key/value line: ${line}`)
    const key = line.slice(0, split).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid environment variable name: ${key}`)
    result[key] = line.slice(split + 1).trim()
  }
  return result
}

function parseJson<T>(formData: FormData, key: string, fallback: T): T {
  const raw = String(formData.get(key) ?? '').trim()
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`${key} must contain valid JSON.`)
  }
}

async function getOwnedConfig(serviceId: string, environmentId: string) {
  const [config] = await db.select().from(serviceConfigs).where(and(
    eq(serviceConfigs.serviceId, serviceId),
    eq(serviceConfigs.environmentId, environmentId),
  )).limit(1)
  if (!config) throw new Error('Service configuration not found.')
  return config
}

function validateVolumePath(path: string, label: string) {
  if (!path.startsWith('/')) throw new Error(`${label} must be an absolute path.`)
  if (path.split('/').includes('..')) throw new Error(`${label} may not contain parent traversal.`)
}

function normalizeVolumes(input: unknown): TrellisVolume[] {
  if (!Array.isArray(input)) throw new Error('Volumes must be a list.')
  if (input.length > 32) throw new Error('A service may define at most 32 volumes.')

  const names = new Set<string>()
  return input.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`Volume ${index + 1} is invalid.`)
    const row = value as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const hostPath = typeof row.host_path === 'string' ? row.host_path.trim() : ''
    const containerPath = typeof row.container_path === 'string' ? row.container_path.trim() : ''

    if (!name || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error(`Volume ${index + 1} needs a valid name.`)
    if (names.has(name)) throw new Error(`Volume name ${name} is duplicated.`)
    names.add(name)

    if (!hostPath) throw new Error(`Volume ${name} needs a backing path.`)
    if (hostPath.startsWith('@/')) {
      if (hostPath === '@/') throw new Error(`Volume ${name} needs a managed-local path after @/.`)
      if (hostPath.slice(2).split('/').includes('..')) throw new Error(`Volume ${name} may not traverse outside its managed-local path.`)
    } else {
      validateVolumePath(hostPath, `Host path for ${name}`)
    }
    validateVolumePath(containerPath, `Container path for ${name}`)

    return {
      name,
      host_path: hostPath,
      container_path: containerPath,
      ...(row.read_only === true ? { read_only: true } : {}),
    }
  })
}

export async function updateServiceVolumesAction(serviceId: string, environmentId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const before = await getOwnedConfig(serviceId, environmentId)
  const volumes = normalizeVolumes(parseJson<unknown[]>(formData, 'volumes', []))

  await db.update(serviceConfigs).set({ volumes, updatedAt: new Date() }).where(eq(serviceConfigs.id, before.id))
  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'service.volumes.updated',
    resourceType: 'service',
    resourceId: serviceId,
    details: {
      environmentId,
      before: (before.volumes as Array<{ name?: string }>).map((item) => item.name).filter(Boolean),
      after: volumes.map((item) => item.name),
    },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}/volumes`)
}

function parseApiAccess(value: string): TrellisApiAccess | undefined {
  if (!value || value === 'none') return undefined
  const [scope, access] = value.split(':')
  if ((scope !== 'namespace' && scope !== 'cluster') || (access !== 'read' && access !== 'write')) {
    throw new Error('Invalid workload API access setting.')
  }
  return { scope, access }
}

type AdvancedConfigValues = {
  runtime: Exclude<TrellisRuntime, ''>
  apiAccessScope: 'namespace' | 'cluster' | null
  apiAccessLevel: 'read' | 'write' | null
}

const ADVANCED_OVERRIDE_FIELDS = ['runtime', 'apiAccessScope', 'apiAccessLevel'] as const

function parseAdvancedConfig(formData: FormData): AdvancedConfigValues {
  const runtimeValue = String(formData.get('runtime') ?? 'runc')
  if (runtimeValue !== 'runc' && runtimeValue !== 'runsc') throw new Error('Runtime must be runc or runsc.')
  const apiAccess = parseApiAccess(String(formData.get('apiAccess') ?? 'none'))
  return {
    runtime: runtimeValue,
    apiAccessScope: apiAccess?.scope ?? null,
    apiAccessLevel: apiAccess?.access ?? null,
  }
}

export async function updateBaseServiceAdvancedAction(serviceId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const base = await getBaseServiceConfig(serviceId)
  if (!base) throw new Error('No base service configuration exists.')
  const values = parseAdvancedConfig(formData)

  await db.update(baseServiceConfigs).set({ ...values, updatedAt: new Date() })
    .where(eq(baseServiceConfigs.serviceId, serviceId))

  const envConfigs = await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId))
  for (const envConfig of envConfigs) {
    const overrides = (envConfig.overrides ?? {}) as Record<string, unknown>
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (!('runtime' in overrides)) patch.runtime = values.runtime
    const apiAccessOverridden = 'apiAccessScope' in overrides || 'apiAccessLevel' in overrides
    if (!apiAccessOverridden) {
      patch.apiAccessScope = values.apiAccessScope
      patch.apiAccessLevel = values.apiAccessLevel
    }
    if (Object.keys(patch).length > 1) {
      await db.update(serviceConfigs).set(patch).where(eq(serviceConfigs.id, envConfig.id))
    }
  }

  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'service.base_config.advanced_updated',
    resourceType: 'service',
    resourceId: serviceId,
    details: {
      before: { runtime: base.runtime, scope: base.apiAccessScope, access: base.apiAccessLevel },
      after: { runtime: values.runtime, scope: values.apiAccessScope, access: values.apiAccessLevel },
    },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}/advanced`)
}

export async function updateServiceAdvancedAction(serviceId: string, environmentId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const config = await getOwnedConfig(serviceId, environmentId)
  const base = await getBaseServiceConfig(serviceId)
  const desired = parseAdvancedConfig(formData)

  const existingOverrides = (config.overrides ?? {}) as Record<string, unknown>
  const newOverrides: Record<string, unknown> = { ...existingOverrides }
  for (const field of ADVANCED_OVERRIDE_FIELDS) delete newOverrides[field]

  if (base) {
    if (desired.runtime !== base.runtime) newOverrides.runtime = desired.runtime
    if (desired.apiAccessScope !== base.apiAccessScope || desired.apiAccessLevel !== base.apiAccessLevel) {
      newOverrides.apiAccessScope = desired.apiAccessScope
      newOverrides.apiAccessLevel = desired.apiAccessLevel
    }
  }

  await db.update(serviceConfigs).set({
    ...desired,
    overrides: Object.keys(newOverrides).length > 0 ? newOverrides : null,
    updatedAt: new Date(),
  }).where(eq(serviceConfigs.id, config.id))

  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'service.advanced.updated',
    resourceType: 'service',
    resourceId: serviceId,
    details: {
      environmentId,
      before: { runtime: config.runtime, scope: config.apiAccessScope, access: config.apiAccessLevel },
      after: { runtime: desired.runtime, scope: desired.apiAccessScope, access: desired.apiAccessLevel },
      overriddenFields: ADVANCED_OVERRIDE_FIELDS.filter((field) => field in newOverrides),
    },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}/advanced`)
}

export async function resetServiceAdvancedOverridesAction(serviceId: string, environmentId: string) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const config = await getOwnedConfig(serviceId, environmentId)
  const base = await getBaseServiceConfig(serviceId)
  if (!base) throw new Error('No base service configuration exists.')

  const newOverrides = { ...((config.overrides ?? {}) as Record<string, unknown>) }
  for (const field of ADVANCED_OVERRIDE_FIELDS) delete newOverrides[field]

  await db.update(serviceConfigs).set({
    runtime: base.runtime,
    apiAccessScope: base.apiAccessScope,
    apiAccessLevel: base.apiAccessLevel,
    overrides: Object.keys(newOverrides).length > 0 ? newOverrides : null,
    updatedAt: new Date(),
  }).where(eq(serviceConfigs.id, config.id))

  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'service.advanced.reset_to_base',
    resourceType: 'service',
    resourceId: serviceId,
    details: { environmentId },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}/advanced`)
}

function normalizeSecretBindings(input: unknown): BowerSecretBinding[] {
  if (!Array.isArray(input)) throw new Error('Secret bindings must be a list.')
  if (input.length > 64) throw new Error('A service may define at most 64 secret bindings.')

  const destinations = new Set<string>()
  return input.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`Secret binding ${index + 1} is invalid.`)
    const row = value as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const target = row.target === 'file' ? 'file' : row.target === 'env' ? 'env' : null
    if (!name || !target) throw new Error(`Secret binding ${index + 1} is incomplete.`)

    if (target === 'env') {
      const env = typeof row.env === 'string' ? row.env.trim() : ''
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(env)) throw new Error(`Secret ${name} needs a valid environment variable target.`)
      const destination = `env:${env}`
      if (destinations.has(destination)) throw new Error(`Environment target ${env} is used more than once.`)
      destinations.add(destination)
      return { name, target, env }
    }

    const path = typeof row.path === 'string' ? row.path.trim() : ''
    if (!path.startsWith('/run/trellis-secrets/') || path.split('/').includes('..')) {
      throw new Error(`Secret ${name} file targets must be below /run/trellis-secrets/.`)
    }
    const destination = `file:${path}`
    if (destinations.has(destination)) throw new Error(`File target ${path} is used more than once.`)
    destinations.add(destination)
    return { name, target, path }
  })
}

export async function updateServiceEnvironmentOverridesAction(serviceId: string, environmentId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const before = await getOwnedConfig(serviceId, environmentId)
  const [environment] = await db.select().from(environments).where(and(
    eq(environments.id, environmentId),
    eq(environments.projectId, access.project.id),
  )).limit(1)
  if (!environment) throw new Error('Environment not found.')

  const envVars = parseLines(String(formData.get('envVars') ?? ''))
  const secretBindings = normalizeSecretBindings(parseJson<unknown[]>(formData, 'secretBindings', []))
  const available = await db.select({ name: secretsMetadata.trellisSecretName }).from(secretsMetadata)
    .where(eq(secretsMetadata.environmentId, environmentId))
  const allowed = new Set(available.map((row) => row.name))
  const missing = secretBindings.find((binding) => !allowed.has(binding.name))
  if (missing) throw new Error(`Secret ${missing.name} does not exist in ${environment.name}.`)

  await db.update(serviceConfigs).set({ envVars, secretBindings, updatedAt: new Date() })
    .where(eq(serviceConfigs.id, before.id))
  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'service.environment_configuration.updated',
    resourceType: 'service',
    resourceId: serviceId,
    details: {
      environmentId,
      environmentVariableNames: Object.keys(envVars),
      secretBindings: secretBindings.map(({ name, target, env, path }) => ({ name, target, env, path })),
    },
  })
  revalidatePath(`/projects/${access.project.slug}/environments`)
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}
