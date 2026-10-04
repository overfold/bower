'use server'

import { createHash, randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { environments, notificationChannels, services, webhookEndpoints } from '@/db/schema'
import { compileTagFilter } from '@/lib/webhook-filter'
import { validateNotificationUrl } from '@/lib/notification-outbound'
import { recordAudit, requireProject } from './shared'

export type WebhookCreationState = { error?: string; token?: string }

export async function createWebhookAction(projectId: string, _state: WebhookCreationState, formData: FormData): Promise<WebhookCreationState> {
  const ctx = await requireProject(projectId); if (ctx.projectRole !== 'admin') return { error: 'Insufficient permissions.' }
  const serviceId = String(formData.get('serviceId') ?? ''); const environmentId = String(formData.get('environmentId') ?? '')
  const [service] = await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.projectId, projectId))).limit(1)
  const [environment] = await db.select().from(environments).where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId))).limit(1)
  if (!service || !environment) return { error: 'Choose a valid service and environment.' }
  const tagFilter = String(formData.get('tagFilter') ?? '').trim() || null
  if (tagFilter) { try { compileTagFilter(tagFilter) } catch { return { error: 'Tag filter must be an RE2-compatible expression of at most 512 characters (no lookaround or backreferences).' } } }
  const token = randomBytes(32).toString('base64url'); const tokenHash = createHash('sha256').update(token).digest('hex')
  const [hook] = await db.insert(webhookEndpoints).values({ serviceId, environmentId, tokenHash, tokenPrefix: token.slice(0, 8), signatureSecretHash: tokenHash, provider: String(formData.get('provider') ?? 'generic') as 'generic' | 'docker_hub' | 'ghcr', deployMode: String(formData.get('deployMode') ?? 'any_push') as 'any_push' | 'tag' | 'digest', tagFilter }).returning()
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'webhook.created', resourceType: 'webhook', resourceId: hook.id, details: { serviceId, environmentId, provider: hook.provider } })
  revalidatePath(`/projects/${ctx.project.slug}/settings`); return { token }
}

export async function deleteWebhookAction(projectId: string, id: string) {
  const ctx = await requireProject(projectId); if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [hook] = await db.select({ id: webhookEndpoints.id }).from(webhookEndpoints).innerJoin(services, eq(services.id, webhookEndpoints.serviceId)).where(and(eq(webhookEndpoints.id, id), eq(services.projectId, projectId))).limit(1); if (!hook) throw new Error('Webhook not found.')
  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id)); await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'webhook.deleted', resourceType: 'webhook', resourceId: id }); revalidatePath(`/projects/${ctx.project.slug}/settings`)
}

export async function createNotificationChannelAction(projectId: string, formData: FormData) {
  const ctx = await requireProject(projectId); if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const name = String(formData.get('name') ?? '').trim(); const url = String(formData.get('url') ?? '').trim()
  if (!name) throw new Error('A name and HTTPS endpoint are required.')
  validateNotificationUrl(url)
  const [channel] = await db.insert(notificationChannels).values({ projectId, name, type: String(formData.get('type') ?? 'http') as 'slack' | 'discord' | 'http', config: { url } }).returning()
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'notification.created', resourceType: 'notification', resourceId: channel.id, details: { name, type: channel.type } }); revalidatePath(`/projects/${ctx.project.slug}/settings`)
}

export async function deleteNotificationChannelAction(projectId: string, id: string) {
  const ctx = await requireProject(projectId); if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  await db.delete(notificationChannels).where(and(eq(notificationChannels.id, id), eq(notificationChannels.projectId, projectId))); await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'notification.deleted', resourceType: 'notification', resourceId: id }); revalidatePath(`/projects/${ctx.project.slug}/settings`)
}
