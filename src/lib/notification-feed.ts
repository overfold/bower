// Client-safe notification types and presentation helpers. Server queries live in deployment-notifications.ts.

/** The badge shows the exact count up to this value, then "9+". */
export const UNREAD_BADGE_MAX = 9

export interface DeploymentNotification {
  id: string
  status: string
  serviceName: string
  projectName: string
  projectSlug: string
  environmentName: string
  triggeredByMe: boolean
  /** When the deployment reached its outcome (ISO 8601). */
  occurredAt: string
  unread: boolean
}

export interface NotificationFeed {
  items: DeploymentNotification[]
  unreadCount: number
  lastSeenAt: string
}

export function unreadBadgeText(unreadCount: number): string | null {
  if (unreadCount <= 0) return null
  return unreadCount > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : String(unreadCount)
}

export function notificationsButtonLabel(unreadCount: number): string {
  return unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
}

/** The newest item's time: marking read up to it never hides an outcome the user hasn't loaded yet. */
export function seenThrough(items: Pick<DeploymentNotification, 'occurredAt'>[]): string | null {
  let newest: string | null = null
  for (const item of items) if (newest === null || Date.parse(item.occurredAt) > Date.parse(newest)) newest = item.occurredAt
  return newest
}
