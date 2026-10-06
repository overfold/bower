export type FailingService = { serviceId: string; environmentId: string; since: Date; cause: string }
export type ServiceKey = { serviceId: string; environmentId: string }
export type OpenIncident = ServiceKey & { id: string; startedAt: Date; cause: string }

const key = (value: ServiceKey) => `${value.serviceId}/${value.environmentId}`

/**
 * Decides how observed service health changes the incident table. A failing service with no open
 * incident opens one (started when its failure began); one with an open incident keeps its original
 * start, so a service is notified once per incident; an open incident whose service was seen healthy
 * resolves. A service we could not observe (Trellis unreachable, still deploying) is left alone.
 */
export function planIncidentSync({ failing, healthy, open, now }: { failing: FailingService[]; healthy: ServiceKey[]; open: OpenIncident[]; now: Date }) {
  const openByKey = new Map(open.map((incident) => [key(incident), incident]))
  const failingKeys = new Set(failing.map(key))
  const healthyKeys = new Set(healthy.map(key))
  return {
    opens: failing.filter((entry) => !openByKey.has(key(entry))).map((entry) => ({ ...entry, since: entry.since.getTime() > now.getTime() ? now : entry.since })),
    touches: failing.flatMap((entry) => {
      const incident = openByKey.get(key(entry))
      return incident ? [{ id: incident.id, cause: entry.cause }] : []
    }),
    resolves: open.filter((incident) => !failingKeys.has(key(incident)) && healthyKeys.has(key(incident))).map((incident) => incident.id),
  }
}
