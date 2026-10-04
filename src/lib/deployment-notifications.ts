import { and, count, desc, eq, gt, gte, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { deployments, deploymentStatusEnum, environments, notificationReadStates, projects, services } from '@/db/schema'
import { getProjectsForUser } from '@/lib/queries'
import { statusDefinition } from '@/lib/status'
import type { Tone } from '@/lib/tone'
import type { NotificationFeed } from '@/lib/notification-feed'

/** The menu shows at most this many items. The unread count is not limited by it. */
export const NOTIFICATION_LIMIT = 20
/** Deployment outcomes older than this are neither listed nor counted. */
export const NOTIFICATION_WINDOW_DAYS = 14

type DeploymentStatusValue = (typeof deploymentStatusEnum.enumValues)[number]

// Classify settled deployment statuses through the shared status vocabulary, not a local map.
function settledDeploymentStatuses(tone: Tone): DeploymentStatusValue[] {
  return deploymentStatusEnum.enumValues.filter((status) => {
    const definition = statusDefinition(status)
    return definition !== undefined && !definition.inProgress && definition.tone === tone
  })
}

/** Failed deployments notify everyone with access to the project. */
export const FAILED_DEPLOYMENT_STATUSES = settledDeploymentStatuses('danger')
/** Successful deployments notify only the user who triggered them. */
export const SUCCEEDED_DEPLOYMENT_STATUSES = settledDeploymentStatuses('success')

// postgres-js can't infer a Date parameter compared with an untyped SQL expression.
function timestamptz(value: Date) {
  return sql`${value.toISOString()}::timestamptz`
}

/**
 * Returns the user's last-seen time for the organization. The first load records "now", so a user's
 * first visit starts with nothing unread instead of a backlog.
 */
export async function getLastSeenAt(userId: string, orgId: string, now = new Date()): Promise<Date> {
  await db.insert(notificationReadStates).values({ userId, orgId, lastSeenAt: now, updatedAt: now })
    .onConflictDoNothing({ target: [notificationReadStates.userId, notificationReadStates.orgId] })
  const [state] = await db.select({ lastSeenAt: notificationReadStates.lastSeenAt }).from(notificationReadStates)
    .where(and(eq(notificationReadStates.userId, userId), eq(notificationReadStates.orgId, orgId))).limit(1)
  return state?.lastSeenAt ?? now
}

/** Moves the last-seen time forward to `through`, capped at `now`. It never moves backward. */
export async function markNotificationsSeen(userId: string, orgId: string, through: Date, now = new Date()): Promise<Date> {
  const seenAt = new Date(Math.min(through.getTime(), now.getTime()))
  const [state] = await db.insert(notificationReadStates).values({ userId, orgId, lastSeenAt: seenAt, updatedAt: now })
    .onConflictDoUpdate({
      target: [notificationReadStates.userId, notificationReadStates.orgId],
      set: { lastSeenAt: sql`greatest(${notificationReadStates.lastSeenAt}, excluded.last_seen_at)`, updatedAt: now },
    })
    .returning({ lastSeenAt: notificationReadStates.lastSeenAt })
  return state.lastSeenAt
}

/**
 * Deployment outcomes for one user in one organization: failures in any project they can access, plus
 * successes they triggered. Access is resolved here, server-side, so no caller can widen it.
 */
export async function loadNotificationFeed(input: {
  userId: string
  orgId: string
  orgRole: 'owner' | 'admin' | 'member'
  now?: Date
  limit?: number
}): Promise<NotificationFeed> {
  const now = input.now ?? new Date()
  const limit = input.limit ?? NOTIFICATION_LIMIT
  const [accessibleProjects, lastSeenAt] = await Promise.all([
    getProjectsForUser(input.orgId, input.userId, input.orgRole),
    getLastSeenAt(input.userId, input.orgId, now),
  ])
  const projectIds = accessibleProjects.map((project) => project.id)
  if (projectIds.length === 0) return { items: [], unreadCount: 0, lastSeenAt: lastSeenAt.toISOString() }

  // Millisecond precision matches the JavaScript timestamps that read markers are built from.
  const occurredAt = sql<Date>`date_trunc('milliseconds', coalesce(${deployments.completedAt}, ${deployments.createdAt}))`
  const windowStart = new Date(now.getTime() - NOTIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const relevant = and(
    eq(projects.orgId, input.orgId),
    inArray(projects.id, projectIds),
    gte(occurredAt, timestamptz(windowStart)),
    or(
      inArray(deployments.status, FAILED_DEPLOYMENT_STATUSES),
      and(eq(deployments.triggeredByUserId, input.userId), inArray(deployments.status, SUCCEEDED_DEPLOYMENT_STATUSES)),
    ),
  )

  const [rows, [unread]] = await Promise.all([
    db.select({
      id: deployments.id,
      status: deployments.status,
      triggeredByUserId: deployments.triggeredByUserId,
      occurredAt,
      serviceName: services.name,
      projectName: projects.name,
      projectSlug: projects.slug,
      environmentName: environments.name,
    }).from(deployments)
      .innerJoin(services, eq(services.id, deployments.serviceId))
      .innerJoin(projects, eq(projects.id, services.projectId))
      .innerJoin(environments, eq(environments.id, deployments.environmentId))
      .where(relevant)
      .orderBy(desc(occurredAt), desc(deployments.id))
      .limit(limit),
    db.select({ value: count() }).from(deployments)
      .innerJoin(services, eq(services.id, deployments.serviceId))
      .innerJoin(projects, eq(projects.id, services.projectId))
      .where(and(relevant, gt(occurredAt, timestamptz(lastSeenAt)))),
  ])

  return {
    items: rows.map((row) => {
      const at = new Date(row.occurredAt)
      return {
        id: row.id,
        status: row.status,
        serviceName: row.serviceName,
        projectName: row.projectName,
        projectSlug: row.projectSlug,
        environmentName: row.environmentName,
        triggeredByMe: row.triggeredByUserId === input.userId,
        occurredAt: at.toISOString(),
        unread: at.getTime() > lastSeenAt.getTime(),
      }
    }),
    unreadCount: unread?.value ?? 0,
    lastSeenAt: lastSeenAt.toISOString(),
  }
}
