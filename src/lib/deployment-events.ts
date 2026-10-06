/** Explicit deployment event classification. Event types are recorded by deployment-reconciler.ts and actions/services.ts. */
export type EventTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const EVENT_TONES: Readonly<Record<string, EventTone>> = {
  failed: 'danger',
  reconciliation_error: 'danger',
  auto_rollback: 'warning',
  scheduling_blocked: 'warning',
  replacement_backoff: 'warning',
  healthy: 'success',
  canary_complete: 'success',
  apply_accepted: 'neutral',
  canary_step: 'neutral',
  deploying: 'neutral',
  planning: 'neutral',
  rollback: 'neutral',
}

export function deploymentEventTone(type: string): EventTone {
  return EVENT_TONES[type] ?? 'neutral'
}

/** The events that explain why a deployment failed or was rolled back, most decisive first. */
const FAILURE_EVENT_TYPES = ['failed', 'auto_rollback'] as const
const DIAGNOSTIC_EVENT_TYPES = ['scheduling_blocked', 'replacement_backoff', 'reconciliation_error'] as const

type EventLike = { type: string; message: string; details?: unknown }

/** The latest terminal failure event, falling back to the latest diagnostic event. */
export function failureEvent<T extends EventLike>(events: T[]): T | undefined {
  for (const types of [FAILURE_EVENT_TYPES, DIAGNOSTIC_EVENT_TYPES] as const) {
    const match = [...events].reverse().find((event) => (types as readonly string[]).includes(event.type))
    if (match) return match
  }
  return undefined
}

/** Allocation ids named by an event's details, in order. */
export function eventAllocationIds(event: EventLike | undefined): string[] {
  const details = event?.details as { allocations?: unknown; groups?: unknown; convergence?: { active?: unknown } } | null | undefined
  const found: string[] = []
  const collect = (value: unknown, key: 'id' | 'last_allocation_id') => {
    if (!Array.isArray(value)) return
    for (const entry of value) {
      const id = (entry as Record<string, unknown> | null)?.[key]
      if (typeof id === 'string' && id) found.push(id)
    }
  }
  collect(details?.allocations, 'id')
  collect(details?.groups, 'last_allocation_id')
  collect(details?.convergence?.active, 'id')
  return found
}

/** The most recent allocation marked failed, lost, or unhealthy inside any event's allocation details. */
function markedFailedAllocationId(events: EventLike[]): string | undefined {
  for (const event of [...events].reverse()) {
    const allocations = (event.details as { allocations?: unknown } | null | undefined)?.allocations
    if (!Array.isArray(allocations)) continue
    const match = allocations.find((entry) => entry && typeof entry.id === 'string' && (['failed', 'lost'].includes(entry.phase) || entry.health === 'unhealthy'))
    if (match) return match.id
  }
  return undefined
}

/**
 * The allocation to open for a failed deployment: the one the failure event names, else one marked
 * failed/unhealthy, else the one a scheduling or backoff diagnostic names. Never an arbitrary first one.
 */
export function failedAllocationId(events: EventLike[]): string | undefined {
  const fromFailure = eventAllocationIds(failureEvent(events))[0]
  if (fromFailure) return fromFailure
  const marked = markedFailedAllocationId(events)
  if (marked) return marked
  for (const event of [...events].reverse()) {
    if (!(DIAGNOSTIC_EVENT_TYPES as readonly string[]).includes(event.type)) continue
    const id = eventAllocationIds(event)[0]
    if (id) return id
  }
  return undefined
}
