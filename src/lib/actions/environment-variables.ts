'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { environments } from '@/db/schema'
import { getTrellisClient } from '@/lib/trellis-instance'
import { recordAudit, requireProject, text } from './shared'

function environmentVariables(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, string>
  return value as Record<string, string>
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
