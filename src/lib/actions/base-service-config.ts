'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { baseServiceConfigs, environments, secretsMetadata, serviceConfigs } from '@/db/schema'
import { getBaseServiceConfig } from '@/lib/queries'
import { recordAudit, requireService } from '@/lib/actions/shared'
import { parseServiceConfigInput } from '@/lib/service-config-input'
import { getTrellisJobLimits } from '@/lib/trellis-instance'
import { assertWorkloadApiAccessAllowed } from '@/lib/workload-policy'
import { serviceConfigAuditState } from '@/lib/audit-details'
import { validateServiceVariableConflicts } from '@/lib/environment-variable-input'

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

async function validateVariablesForEnvironment(
  projectId: string,
  environmentId: string,
  envVars: Record<string, string>,
  secretBindings: Parameters<typeof validateServiceVariableConflicts>[1],
) {
  const [environment] = await db.select().from(environments).where(and(
    eq(environments.id, environmentId),
    eq(environments.projectId, projectId),
  )).limit(1)
  if (!environment) throw new Error('Environment not found.')
  const available = await db.select({ name: secretsMetadata.trellisSecretName }).from(secretsMetadata)
    .where(eq(secretsMetadata.environmentId, environmentId))
  const environmentEnv = environment.envVars && typeof environment.envVars === 'object' && !Array.isArray(environment.envVars)
    ? environment.envVars as Record<string, string>
    : {}
  validateServiceVariableConflicts(envVars, secretBindings, environmentEnv, new Set(available.map((row) => row.name)), environment.name)
}

export async function upsertBaseServiceConfigAction(serviceId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')

  const values = parseServiceConfigInput(formData, await getTrellisJobLimits(access.org.id))
  const before = await getBaseServiceConfig(serviceId)

  const allEnvConfigs = await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId))
  for (const envConfig of allEnvConfigs) {
    const overrides = (envConfig.overrides ?? {}) as Record<string, unknown>
    await validateVariablesForEnvironment(
      access.project.id,
      envConfig.environmentId,
      ('envVars' in overrides ? envConfig.envVars : values.envVars) as Record<string, string>,
      ('secretBindings' in overrides ? envConfig.secretBindings : values.secretBindings) as Parameters<typeof validateServiceVariableConflicts>[1],
    )
  }

  await db.insert(baseServiceConfigs)
    .values({ serviceId, ...values })
    .onConflictDoUpdate({ target: baseServiceConfigs.serviceId, set: values })

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
    details: { before: serviceConfigAuditState(before), after: serviceConfigAuditState(values) },
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

  const desired = parseServiceConfigInput(formData, await getTrellisJobLimits(access.org.id))
  await validateVariablesForEnvironment(access.project.id, environmentId, desired.envVars, desired.secretBindings)
  const runtime = formData.has('runtime') ? String(formData.get('runtime')) : envConfig.runtime
  if (runtime !== 'runc' && runtime !== 'runsc') throw new Error('Runtime must be runc or runsc.')
  const existingApiAccess = envConfig.apiAccessScope && envConfig.apiAccessLevel ? `${envConfig.apiAccessScope}:${envConfig.apiAccessLevel}` : 'none'
  const apiAccessValue = formData.has('apiAccess') ? String(formData.get('apiAccess')) : existingApiAccess
  if (apiAccessValue !== 'none' && apiAccessValue !== 'cluster:read' && apiAccessValue !== 'cluster:write') throw new Error('Invalid workload API access setting.')
  const apiAccess = apiAccessValue === 'none' ? undefined : { scope: 'cluster' as const, access: apiAccessValue === 'cluster:read' ? 'read' as const : 'write' as const }
  assertWorkloadApiAccessAllowed(apiAccess, access.user.isInstanceAdmin)
  const advanced = { runtime, apiAccessScope: apiAccess?.scope ?? null, apiAccessLevel: apiAccess?.access ?? null }
  const base = await getBaseServiceConfig(serviceId)

  const newOverrides: Record<string, unknown> = {}
  if (base) {
    for (const [key, val] of Object.entries(desired) as Array<[string, unknown]>) {
      if (key === 'updatedAt') continue
      // Validate the submitted values, not the stored base: an environment
      // override must be able to correct a previously saved invalid value.
      const baseVal = (base as Record<string, unknown>)[key]
      if (!deepEqual(val, baseVal)) {
        newOverrides[key] = val
      }
    }
    for (const [key, val] of Object.entries(advanced)) {
      if (!deepEqual(val, (base as Record<string, unknown>)[key])) newOverrides[key] = val
    }
  }

  await db.update(serviceConfigs)
    .set({ ...desired, ...advanced, overrides: Object.keys(newOverrides).length > 0 ? newOverrides : null })
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
  await validateVariablesForEnvironment(
    access.project.id,
    environmentId,
    base.envVars as Record<string, string>,
    base.secretBindings as Parameters<typeof validateServiceVariableConflicts>[1],
  )

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
