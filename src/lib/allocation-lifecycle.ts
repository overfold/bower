import { allocationCause, isFailingAllocation } from '@/lib/service-failure'
import { statusLabel } from '@/lib/status'
import type { Tone } from '@/lib/tone'
import type { TrellisAllocation, TrellisEvent } from '@/types/trellis'

/** Shared field names for Trellis's allocation counters, so every allocation page uses the same words. */
export const allocationFields = {
  generation: { label: 'Generation', hint: 'The Trellis allocation generation.' },
  attempt: { label: 'Attempt', hint: 'The current Trellis allocation attempt.' },
} as const

type TimelineTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

/** Every failed or lost transition is toned, not just the last one: earlier crashes explain a restart loop. */
export function lifecycleEventTone(event: Pick<TrellisEvent, 'phase'>, isLast: boolean): TimelineTone {
  if (event.phase === 'failed' || event.phase === 'lost') return 'danger'
  if (event.phase === 'running' && isLast) return 'success'
  return 'neutral'
}

/** Failed stays Failed and Lost stays Lost; "Failing" is a service-level word. */
export function lifecycleEventTitle(event: Pick<TrellisEvent, 'phase'>, nodeId?: string): string {
  if (event.phase === 'placed' && nodeId) return `Placed on ${nodeId}`
  return statusLabel(event.phase) ?? event.phase.charAt(0).toUpperCase() + event.phase.slice(1)
}

export type AllocationNotice = { tone: Tone; title: string; text: string }

/** The reason and message Trellis gave for the allocation's state, shown under the header on every tab. */
export function allocationNotice(allocation: Pick<TrellisAllocation, 'phase' | 'health' | 'reason' | 'message' | 'draining'>): AllocationNotice | null {
  const text = allocationCause(allocation)
  if (isFailingAllocation(allocation)) {
    const title = allocation.phase === 'lost' ? 'Lost' : allocation.phase === 'failed' ? 'Failed' : 'Unhealthy'
    return { tone: 'danger', title, text: text ?? (allocation.phase === 'failed' ? 'Trellis reported no reason for this failure.' : 'Health checks are failing.') }
  }
  if (allocation.phase === 'pending') return { tone: 'warn', title: 'Waiting for placement', text: text ?? 'Awaiting placement' }
  if (allocation.draining) return { tone: 'warn', title: 'Draining', text: text ?? 'This allocation is being moved off its node.' }
  return null
}
