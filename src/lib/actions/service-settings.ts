'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { baseServiceConfigs, environments, projectVolumes, secretsMetadata, serviceConfigs } from '@/db/schema'
import { getBaseServiceConfig } from '@/lib/queries'
import { recordAudit, requireService } from '@/lib/actions/shared'
import type { TrellisApiAccess, TrellisRuntime } from '@/types/trellis'
import { parseKeyValueLines } from '@/lib/service-config-input'
import { parseJsonInput, validateSecretBindings, validateVolumeMounts } from '@/lib/workload-input'
import { assertWorkloadApiAccessAllowed } from '@/lib/workload-policy'

async function getOwnedConfig(serviceId: string, environmentId: string) {
  const [config] = await db.select().from(serviceConfigs).where(and(
    eq(serviceConfigs.serviceId, serviceId),
    eq(serviceConfigs.environmentId, environmentId),
  )).limit(1)
  if (!config) throw new Error('Service configuration not found.')
  return config
}

export async function updateServiceVolumeMountsAction(serviceId: string, environmentId: string | null, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const mounts = validateVolumeMounts(parseJsonInput(formData, 'volumes', []))
  const environmentIds = environmentId
    ? [environmentId]
    : (await db.select({ id: environments.id }).from(environments).where(eq(environments.projectId, access.project.id))).map((row) => row.id)
  const definitions = environmentIds.length
    ? await db.select({ environmentId: projectVolumes.environmentId, name: projectVolumes.name }).from(projectVolumes)
      .where(eq(projectVolumes.projectId, access.project.id))
    : []
  for (const id of environmentIds) {
    const available = new Set(definitions.filter((row) => row.environmentId === id).map((row) => row.name))
    const missing = mounts.find((mount) => !available.has(mount.name))
    if (missing) throw new Error(`Volume ${missing.name} is not defined in every affected environment.`)
  }

  if (!environmentId) {
    await db.update(baseServiceConfigs).set({ volumes: mounts, updatedAt: new Date() }).where(eq(baseServiceConfigs.serviceId, serviceId))
    const configs = await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId))
    for (const config of configs) {
      const overrides = (config.overrides ?? {}) as Record<string, unknown>
      if (!('volumes' in overrides)) {
        await db.update(serviceConfigs).set({ volumes: mounts, updatedAt: new Date() }).where(eq(serviceConfigs.id, config.id))
      }
    }
  } else {
    const config = await getOwnedConfig(serviceId, environmentId)
    const base = await getBaseServiceConfig(serviceId)
    const overrides = { ...((config.overrides ?? {}) as Record<string, unknown>) }
    if (JSON.stringify(mounts) === JSON.stringify(base?.volumes ?? [])) delete overrides.volumes
    else overrides.volumes = mounts
    await db.update(serviceConfigs).set({
      volumes: mounts,
      overrides: Object.keys(overrides).length ? overrides : null,
      updatedAt: new Date(),
    }).where(eq(serviceConfigs.id, config.id))
  }
  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'service.volume_mounts.updated',
    resourceType: 'service',
    resourceId: serviceId,
    details: {
      environmentId,
      volumes: mounts.map((item) => item.name),
    },
  })
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}/mounts`)
}

function parseApiAccess(value: string): TrellisApiAccess | undefined {
  if (!value || value === 'none') return undefined
  if (value !== 'cluster:read' && value !== 'cluster:write') {
    throw new Error('Invalid workload API access setting.')
  }
  return { scope: 'cluster', access: value === 'cluster:read' ? 'read' : 'write' }
}

type AdvancedConfigValues = {
  runtime: Exclude<TrellisRuntime, ''>
  apiAccessScope: 'cluster' | null
  apiAccessLevel: 'read' | 'write' | null
}

const ADVANCED_OVERRIDE_FIELDS = ['runtime', 'apiAccessScope', 'apiAccessLevel'] as const

function parseAdvancedConfig(formData: FormData, isInstanceAdmin: boolean): AdvancedConfigValues {
  const runtimeValue = String(formData.get('runtime') ?? 'runc')
  if (runtimeValue !== 'runc' && runtimeValue !== 'runsc') throw new Error('Runtime must be runc or runsc.')
  const apiAccess = parseApiAccess(String(formData.get('apiAccess') ?? 'none'))
  assertWorkloadApiAccessAllowed(apiAccess, isInstanceAdmin)
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
  const values = parseAdvancedConfig(formData, access.user.isInstanceAdmin)

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
  const desired = parseAdvancedConfig(formData, access.user.isInstanceAdmin)

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
  const baseApiAccess =
    base.apiAccessScope === 'cluster' &&
    (base.apiAccessLevel === 'read' || base.apiAccessLevel === 'write')
      ? { scope: base.apiAccessScope, access: base.apiAccessLevel } as TrellisApiAccess
      : undefined
  assertWorkloadApiAccessAllowed(baseApiAccess, access.user.isInstanceAdmin)

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

export async function updateServiceEnvironmentOverridesAction(serviceId: string, environmentId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const before = await getOwnedConfig(serviceId, environmentId)
  const [environment] = await db.select().from(environments).where(and(
    eq(environments.id, environmentId),
    eq(environments.projectId, access.project.id),
  )).limit(1)
  if (!environment) throw new Error('Environment not found.')

  let envRows: unknown
  try { envRows = JSON.parse(String(formData.get('envVars') ?? '[]')) } catch { throw new Error('Service variables must be valid JSON.') }
  if (!Array.isArray(envRows)) throw new Error('Service variables must be a list.')
  const lines = envRows.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Each service variable must have a name and value.')
    const row = entry as Record<string, unknown>
    if (typeof row.key !== 'string' || typeof row.value !== 'string') throw new Error('Each service variable must have a name and value.')
    return `${row.key}=${row.value}`
  }).join('\n')
  const envVars = parseKeyValueLines(lines, 'env')
  if (Object.keys(envVars).length !== envRows.length) throw new Error('Service variable names must be unique.')
  const secretBindings = validateSecretBindings(parseJsonInput(formData, 'secretBindings', []))
  const environmentEnv = environment.envVars && typeof environment.envVars === 'object' && !Array.isArray(environment.envVars)
    ? environment.envVars as Record<string, string>
    : {}
  const conflictingEnvironmentVariable = Object.keys(envVars).find((name) => name in environmentEnv)
  if (conflictingEnvironmentVariable) throw new Error(`${conflictingEnvironmentVariable} is already defined by the environment.`)
  const conflictingSecretEnv = secretBindings.find((binding) => binding.target === 'env' && binding.env && binding.env in envVars)
  if (conflictingSecretEnv) throw new Error(`Secret target ${conflictingSecretEnv.env} conflicts with a service variable.`)
  const environmentSecretNames = new Set(Object.values(environmentEnv))
  const duplicateEnvironmentSecret = secretBindings.find((binding) => environmentSecretNames.has(binding.name))
  if (duplicateEnvironmentSecret) throw new Error(`Secret ${duplicateEnvironmentSecret.name} is already injected by the environment.`)
  const available = await db.select({ name: secretsMetadata.trellisSecretName }).from(secretsMetadata)
    .where(eq(secretsMetadata.environmentId, environmentId))
  const allowed = new Set(available.map((row) => row.name))
  const missing = secretBindings.find((binding) => !allowed.has(binding.name))
  if (missing) throw new Error(`Secret ${missing.name} does not exist in ${environment.name}.`)

  const base = await getBaseServiceConfig(serviceId)
  const overrides = { ...((before.overrides ?? {}) as Record<string, unknown>) }
  if (JSON.stringify(envVars) === JSON.stringify(base?.envVars ?? {})) delete overrides.envVars
  else overrides.envVars = envVars
  if (JSON.stringify(secretBindings) === JSON.stringify(base?.secretBindings ?? [])) delete overrides.secretBindings
  else overrides.secretBindings = secretBindings

  await db.update(serviceConfigs).set({
    envVars,
    secretBindings,
    overrides: Object.keys(overrides).length ? overrides : null,
    updatedAt: new Date(),
  })
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
  revalidatePath(`/projects/${access.project.slug}/environment`)
  revalidatePath(`/projects/${access.project.slug}/services/${access.service.slug}`)
}
