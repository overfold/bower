import { isStuckPending } from '@/lib/service-health'
import type { TrellisAllocation, TrellisReplacementBackoff } from '@/types/trellis'

type FailureAllocation = Pick<TrellisAllocation, 'id' | 'phase' | 'health' | 'last_transition_at' | 'created_at' | 'reason' | 'message'>

export type ServiceFailure = {
  /** The most specific cause: restart backoff first, then the failing allocation, then a placement problem. */
  cause: string
  /** Other distinct messages worth showing under the cause. */
  details: string[]
  /** The earliest failure signal we can see (not the latest transition). ISO 8601. */
  failingSince?: string
  /** The most recent failure signal. ISO 8601. */
  lastFailureAt?: string
  failures?: number
  nextAttemptAt?: string
  /** The allocation whose page explains the failure. */
  allocationId?: string
  kind: 'restart_backoff' | 'allocation' | 'unplaceable'
}

export function isFailingAllocation(allocation: Pick<TrellisAllocation, 'phase' | 'health'>): boolean {
  return allocation.health === 'unhealthy' || allocation.phase === 'failed' || allocation.phase === 'lost'
}

/** The text Trellis gave for an allocation, readable ("insufficient_cpu" → "insufficient cpu"). */
export function allocationCause(allocation: Pick<TrellisAllocation, 'phase' | 'reason' | 'message'>): string | null {
  if (allocation.message) return allocation.message
  if (!allocation.reason) return null
  const reason = allocation.reason.replaceAll('_', ' ')
  return allocation.phase === 'pending' ? `Awaiting placement: ${reason}` : reason
}

const time = (value: string | undefined) => {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : null
}

/** One summary of why a service is failing, shared by Needs attention, the service page, and notifications. */
export function serviceFailure({ allocations, backoffs = [], now = Date.now() }: {
  allocations: FailureAllocation[]
  backoffs?: TrellisReplacementBackoff[]
  now?: number
}): ServiceFailure | null {
  const failing = allocations.filter(isFailingAllocation)
  const stuck = allocations.filter((allocation) => isStuckPending(allocation, now))
  const backoff = [...backoffs].sort((a, b) => (time(b.last_failure_at) ?? 0) - (time(a.last_failure_at) ?? 0))[0]
  if (!failing.length && !stuck.length && !backoff) return null

  const latestFailing = [...failing].sort((a, b) => (time(b.last_transition_at) ?? 0) - (time(a.last_transition_at) ?? 0))[0]
  const backoffCause = backoff?.message || backoff?.reason
  const allocationText = latestFailing ? allocationCause(latestFailing) : null
  const stuckText = stuck.map(allocationCause).find(Boolean) ?? null
  const cause = backoffCause || allocationText || stuckText || (stuck.length ? 'Awaiting placement' : 'Health checks are failing')
  const details = [...new Set([allocationText, stuckText].filter((text): text is string => Boolean(text) && text !== cause))]

  const signals = [
    ...failing.map((allocation) => time(allocation.last_transition_at)),
    ...stuck.map((allocation) => time(allocation.last_transition_at) ?? time(allocation.created_at)),
    time(backoff?.last_failure_at),
  ].filter((value): value is number => value !== null)
  const iso = (value: number) => new Date(value).toISOString()
  // The allocation to open must exist in the list: a garbage-collected one would be a 404.
  const listed = (id: string | undefined) => id && allocations.some((allocation) => allocation.id === id) ? id : undefined

  return {
    cause,
    details,
    failingSince: signals.length ? iso(Math.min(...signals)) : undefined,
    lastFailureAt: signals.length ? iso(Math.max(...signals)) : undefined,
    failures: backoff?.failures,
    nextAttemptAt: backoff?.next_replacement_at,
    allocationId: latestFailing?.id ?? listed(backoff?.last_allocation_id) ?? stuck[0]?.id,
    kind: backoff ? 'restart_backoff' : latestFailing ? 'allocation' : 'unplaceable',
  }
}
