import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { notificationChannels } from '@/db/schema'
import { postNotification } from './notification-outbound'

export async function sendDeploymentNotifications(projectId: string, payload: Record<string, unknown>) {
  const channels = await db.select().from(notificationChannels).where(eq(notificationChannels.projectId, projectId))
  await Promise.allSettled(channels.filter((channel) => channel.isActive).map(async (channel) => {
    const config = channel.config as { url?: string }
    if (!config.url) return
    const body = channel.type === 'slack'
      ? { text: `Bower deployment ${payload.status}: ${payload.service} → ${payload.environment} (${payload.image})`, attachments: [{ fields: Object.entries(payload).map(([title, value]) => ({ title, value: String(value), short: true })) }] }
      : channel.type === 'discord'
        ? { content: `Bower deployment **${payload.status}**`, embeds: [{ fields: Object.entries(payload).map(([name, value]) => ({ name, value: String(value), inline: true })) }] }
        : payload
    const status = await postNotification(config.url, body)
    if (status < 200 || status >= 300) throw new Error(`Notification ${channel.name} returned ${status}.`)
  }))
}
