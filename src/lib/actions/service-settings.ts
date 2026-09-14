'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { environments, secretsMetadata, serviceConfigs, serviceDeployments } from '@/db/schema'
import { serviceAdvancedSettings } from '@/db/service-advanced-schema'
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

async function getOwnedConfig(serviceId: string) {
  const [config] = await db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId)).limit(1)
  if (!config) throw new Error('Service configuration not found.')
  return config
}

async function getOwnedDeployment(serviceId: string, environmentId: string) {
  const [target] = await db.select().from(serviceDeployments).where(and(
    eq(serviceDeployments.serviceId, serviceId),
    eq(serviceDeployments.environmentId, environmentId),
  )).limit(1)
  if (!target) throw new Error('Service deployment target not found.')
  return target
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

export async function updateServiceVolumesAction(serviceId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const before = await getOwnedConfig(serviceId)
  const volumes = normalizeVolumes(parseJson<unknown[]>(formData, 'volumes', []))

  await db.update(serviceConfigs).set({ volumes, updatedAt: new Date() }).where(eq(serviceConfigs.id, before.id))
  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'service.volumes.updated',
    resourceType: 'service',
    resourceId: serviceId,
    details: {
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

export async function updateServiceAdvancedAction(serviceId: string, formData: FormData) {
  const access = await requireService(serviceId)
  if (access.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const config = await getOwnedConfig(serviceId)
  const runtimeValue = String(formData.get('runtime') ?? 'runc')
  if (runtimeValue !== 'runc' && runtimeValue !== 'runsc') throw new Error('Runtime must be runc or runsc.')
  const runtime = runtimeValue as Exclude<TrellisRuntime, ''>
  const apiAccess = parseApiAccess(String(formData.get('apiAccess') ?? 'none'))

  const [before] = await db.select().from(serviceAdvancedSettings)
    .where(eq(serviceAdvancedSettings.serviceConfigId, config.id)).limit(1)
  const values = {
    serviceConfigId: config.id,
    runtime,
    apiAccessScope: apiAccess?.scope ?? null,
    apiAccessLevel: apiAccess?.access ?? null,
    updatedAt: new Date(),
  }
  await db.insert(serviceAdvancedSettings).values(values).onConflictDoUpdate({
    target: serviceAdvancedSettings.serviceConfigId,
    set: values,
  })
  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'service.advanced.updated',
    resourceType: 'service',
    resourceId: serviceId,
    details: {
      before: before ? { runtime: before.runtime, scope: before.apiAccessScope, access: before.apiAccessLevel } : null,
      after: { runtime, scope: apiAccess?.scope ?? null, access: apiAccess?.access ?? null },
    },
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
  const before = await getOwnedDeployment(serviceId, environmentId)
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

  await db.update(serviceDeployments).set({ envVars, secretBindings, updatedAt: new Date() })
    .where(eq(serviceDeployments.id, before.id))
  await recordAudit({
    orgId: access.org.id,
    userId: access.user.id,
    action: 'service.environment_context.updated',
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
