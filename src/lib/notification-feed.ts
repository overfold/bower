// Client-safe notification types and presentation helpers. Server queries live in deployment-notifications.ts.

/** The badge shows the exact count up to this value, then "9+". */
export const UNREAD_BADGE_MAX = 9

export interface DeploymentNotification {
  kind: 'deployment'
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

/** A service that is failing at runtime (restart backoff, failing or unplaceable allocations), once per incident. */
export interface ServiceHealthNotification {
  kind: 'service'
  /** The incident id: a service notifies once per failing period, not on every poll. */
  id: string
  status: 'failing'
  serviceName: string
  serviceSlug: string
  projectName: string
  projectSlug: string
  environmentName: string
  cause: string
  /** When the service started failing (ISO 8601). */
  occurredAt: string
  unread: boolean
}

export type NotificationItem = DeploymentNotification | ServiceHealthNotification

export interface NotificationFeed {
  items: NotificationItem[]
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
export function seenThrough(items: Pick<NotificationItem, 'occurredAt'>[]): string | null {
  let newest: string | null = null
  for (const item of items) if (newest === null || Date.parse(item.occurredAt) > Date.parse(newest)) newest = item.occurredAt
  return newest
}

/** Where a notification opens: the deployment's diagnostics, or the failing service. */
export function notificationHref(item: NotificationItem): string {
  return item.kind === 'service' ? `/projects/${item.projectSlug}/services/${item.serviceSlug}` : `/projects/${item.projectSlug}/deployments/${item.id}`
}

/** Newest first, capped to the menu's size; the unread count is computed separately and is not capped. */
export function mergeNotificationItems(groups: NotificationItem[][], limit: number): NotificationItem[] {
  return groups.flat().sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id)).slice(0, limit)
}
