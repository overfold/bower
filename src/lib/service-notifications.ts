import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { environments, projects, serviceIncidents, services } from '@/db/schema'
import { getProjectEnvironment } from '@/lib/queries'
import { serviceFailure } from '@/lib/service-failure'
import { getProjectLiveServices } from '@/lib/service-health-query'
import { planIncidentSync, type FailingService, type OpenIncident, type ServiceKey } from '@/lib/service-incidents'
import type { ServiceHealthNotification } from '@/lib/notification-feed'

type Project = { id: string; name: string; slug: string }
type Observation = { failing: FailingService[]; healthy: ServiceKey[] }

const CACHE_TTL_MS = 15_000
const CONCURRENCY = 4
const observations = new Map<string, { at: number; value: Promise<Observation> }>()

/** Trellis is read at most once per project every 15 seconds, however many users poll the feed. */
function observeProject(orgId: string, project: Project, now: Date): Promise<Observation> {
  const cacheKey = `${orgId}/${project.id}`
  const cached = observations.get(cacheKey)
  if (cached && now.getTime() - cached.at < CACHE_TTL_MS) return cached.value
  const value = (async (): Promise<Observation> => {
    const environment = await getProjectEnvironment(project.id)
    if (!environment) return { failing: [], healthy: [] }
    const live = await getProjectLiveServices(orgId, project.id, environment)
    // An unreadable cluster says nothing about service health: neither open nor resolve incidents.
    if (live.error) return { failing: [], healthy: [] }
    const result: Observation = { failing: [], healthy: [] }
    for (const row of live.services) {
      const key = { serviceId: row.service.id, environmentId: environment.id }
      if (['down', 'degraded'].includes(row.health)) {
        const backoffs = live.jobs.filter((job) => job.name === (row.config?.activeJobName || row.service.slug)).flatMap((job) => job.replacement_backoff ?? [])
        const failure = serviceFailure({ allocations: row.allocations, backoffs, now: now.getTime() })
        if (failure) result.failing.push({ ...key, since: new Date(failure.failingSince ?? now), cause: failure.cause })
      } else if (['healthy', 'stopped', 'never'].includes(row.health)) result.healthy.push(key)
    }
    return result
  })()
  observations.set(cacheKey, { at: now.getTime(), value })
  value.catch(() => observations.delete(cacheKey))
  return value
}

async function mapLimited<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let index = 0; index < items.length; index += limit) results.push(...await Promise.all(items.slice(index, index + limit).map(work)))
  return results
}

/**
 * Services failing at runtime in projects the user can access, one notification per incident. Live
 * health is observed from Trellis, recorded as an incident (so the start time and the dedupe survive
 * Trellis forgetting old allocations), and listed while the incident is open.
 */
export async function loadServiceHealthNotifications({ orgId, projects: accessible, lastSeenAt, now }: { orgId: string; projects: Project[]; lastSeenAt: Date; now: Date }): Promise<{ items: ServiceHealthNotification[]; unreadCount: number }> {
  const projectIds = accessible.map((project) => project.id)
  if (!projectIds.length) return { items: [], unreadCount: 0 }
  const observed = await mapLimited(accessible, CONCURRENCY, (project) => observeProject(orgId, project, now).catch(() => ({ failing: [], healthy: [] }) as Observation))
  const failing = observed.flatMap((entry) => entry.failing)
  const healthy = observed.flatMap((entry) => entry.healthy)

  const openRows = await db.select({ id: serviceIncidents.id, serviceId: serviceIncidents.serviceId, environmentId: serviceIncidents.environmentId, startedAt: serviceIncidents.startedAt, cause: serviceIncidents.cause })
    .from(serviceIncidents)
    .innerJoin(services, eq(services.id, serviceIncidents.serviceId))
    .where(and(isNull(serviceIncidents.resolvedAt), inArray(services.projectId, projectIds)))
  const plan = planIncidentSync({ failing, healthy, open: openRows as OpenIncident[], now })
  if (plan.opens.length) await db.insert(serviceIncidents).values(plan.opens.map((entry) => ({ serviceId: entry.serviceId, environmentId: entry.environmentId, startedAt: entry.since, cause: entry.cause, lastObservedAt: now }))).onConflictDoNothing()
  for (const touch of plan.touches) await db.update(serviceIncidents).set({ cause: touch.cause, lastObservedAt: now }).where(eq(serviceIncidents.id, touch.id))
  if (plan.resolves.length) await db.update(serviceIncidents).set({ resolvedAt: now, lastObservedAt: now }).where(inArray(serviceIncidents.id, plan.resolves))

  const rows = await db.select({
    id: serviceIncidents.id, startedAt: sql<Date>`date_trunc('milliseconds', ${serviceIncidents.startedAt})`, cause: serviceIncidents.cause,
    serviceName: services.name, serviceSlug: services.slug, projectName: projects.name, projectSlug: projects.slug, environmentName: environments.name,
  }).from(serviceIncidents)
    .innerJoin(services, eq(services.id, serviceIncidents.serviceId))
    .innerJoin(projects, eq(projects.id, services.projectId))
    .innerJoin(environments, eq(environments.id, serviceIncidents.environmentId))
    .where(and(isNull(serviceIncidents.resolvedAt), inArray(projects.id, projectIds), eq(projects.orgId, orgId)))
  const items = rows.map((row): ServiceHealthNotification => {
    const at = new Date(row.startedAt)
    return { kind: 'service', id: row.id, status: 'failing', serviceName: row.serviceName, serviceSlug: row.serviceSlug, projectName: row.projectName, projectSlug: row.projectSlug, environmentName: row.environmentName, cause: row.cause, occurredAt: at.toISOString(), unread: at.getTime() > lastSeenAt.getTime() }
  })
  return { items, unreadCount: items.filter((item) => item.unread).length }
}
