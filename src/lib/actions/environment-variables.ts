'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { environments } from '@/db/schema'
import { getTrellisClient } from '@/lib/trellis-instance'
import { recordAudit, requireProject, text } from './shared'
import { parseEnvironmentVariableRows } from '@/lib/environment-variable-input'

function environmentVariables(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, string>
  return value as Record<string, string>
}

export async function updateEnvironmentVariablesAction(projectId: string, environmentId: string, formData: FormData) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const rows = parseEnvironmentVariableRows(formData.get('envVars'))
  const [environment] = await db.select().from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId))).limit(1)
  if (!environment) throw new Error('Environment not found.')
  const existing = environmentVariables(environment.envVars)
  const next: Record<string, string> = {}
  const client = await getTrellisClient(ctx.org.id)
  for (const row of rows) {
    const secretName = existing[row.key] ?? `BOWER_ENV_${row.key}`
    if (!existing[row.key] && !row.value) throw new Error(`A value is required for ${row.key}.`)
    if (row.value) await client.setSecret(environment.trellisNamespace, secretName, row.value)
    next[row.key] = secretName
  }
  for (const [name, secretName] of Object.entries(existing)) {
    if (!(name in next)) await client.deleteSecret(environment.trellisNamespace, secretName).catch(() => undefined)
  }
  await db.transaction(async (tx) => {
    await tx.update(environments).set({ envVars: next, updatedAt: new Date() }).where(eq(environments.id, environment.id))
  })
  await recordAudit({
    orgId: ctx.org.id, userId: ctx.user.id, action: 'environment_variables.updated',
    resourceType: 'environment', resourceId: environment.id,
    details: { created: rows.filter((row) => !(row.key in existing)).map((row) => row.key), deleted: Object.keys(existing).filter((name) => !(name in next)), rotated: rows.filter((row) => existing[row.key] && row.value).map((row) => row.key) },
  })
  revalidatePath(`/projects/${ctx.project.slug}/environment`)
}

function variableName(formData: FormData) {
  const name = text(formData, 'name').trim().toUpperCase()
  if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) {
    throw new Error('Use a valid environment variable name, such as DATABASE_URL.')
  }
  return name
}

export async function setEnvironmentVariableAction(projectId: string, environmentId: string, formData: FormData) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')

  const name = variableName(formData)
  const value = text(formData, 'value')
  if (!value) throw new Error('A value is required.')

  const [environment] = await db.select().from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId))).limit(1)
  if (!environment) throw new Error('Environment not found.')

  const existing = environmentVariables(environment.envVars)
  const secretName = existing[name] ?? `BOWER_ENV_${name}`
  const client = await getTrellisClient(ctx.org.id)
  await client.setSecret(environment.trellisNamespace, secretName, value)

  const envVars = { ...existing, [name]: secretName }
  await db.update(environments).set({ envVars, updatedAt: new Date() }).where(eq(environments.id, environment.id))
  await recordAudit({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    action: existing[name] ? 'environment_variable.rotated' : 'environment_variable.created',
    resourceType: 'environment_variable',
    resourceId: `${environment.id}:${name}`,
    details: { name },
  })
  revalidatePath(`/projects/${ctx.project.slug}/environment`)
}

export async function deleteEnvironmentVariableAction(projectId: string, environmentId: string, name: string) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')

  const [environment] = await db.select().from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId))).limit(1)
  if (!environment) return

  const existing = environmentVariables(environment.envVars)
  const secretName = existing[name]
  if (!secretName) return

  const client = await getTrellisClient(ctx.org.id)
  await client.deleteSecret(environment.trellisNamespace, secretName).catch(() => undefined)

  const envVars = { ...existing }
  delete envVars[name]
  await db.update(environments).set({ envVars, updatedAt: new Date() }).where(eq(environments.id, environment.id))
  await recordAudit({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    action: 'environment_variable.deleted',
    resourceType: 'environment_variable',
    resourceId: `${environment.id}:${name}`,
    details: { name },
  })
  revalidatePath(`/projects/${ctx.project.slug}/environment`)
}
