'use server'

import { markNotificationsSeen } from '@/lib/deployment-notifications'
import { requireContext } from './shared'

/** Marks the current organization's notifications as read up to `through` (an ISO timestamp). */
export async function markNotificationsSeenAction(through: string) {
  const ctx = await requireContext()
  const seenAt = new Date(through)
  if (!Number.isFinite(seenAt.getTime())) return { error: 'Invalid time.' }
  const lastSeenAt = await markNotificationsSeen(ctx.user.id, ctx.org.id, seenAt)
  return { lastSeenAt: lastSeenAt.toISOString() }
}
