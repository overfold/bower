import type { Tone } from '@/lib/tone'

export type StatusDefinition = Readonly<{ label: string; tone: Tone; inProgress?: boolean }>

/** The single source of truth for status copy and presentation. */
export const statuses: Readonly<Record<string, StatusDefinition>> = {
  healthy: { label: 'Healthy', tone: 'success' },
  succeeded: { label: 'Succeeded', tone: 'success' },
  ready: { label: 'Healthy', tone: 'success' },
  running: { label: 'Running', tone: 'success' },
  deploying: { label: 'Deploying', tone: 'neutral', inProgress: true },
  rolling_back: { label: 'In progress', tone: 'neutral', inProgress: true },
  pending: { label: 'Pending', tone: 'neutral', inProgress: true },
  planning: { label: 'In progress', tone: 'neutral', inProgress: true },
  starting: { label: 'Starting', tone: 'neutral', inProgress: true },
  placed: { label: 'Placed', tone: 'neutral', inProgress: true },
  stopping: { label: 'In progress', tone: 'neutral', inProgress: true },
  stopped: { label: 'Stopped', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'neutral' },
  dead: { label: 'Dead', tone: 'neutral' },
  draining: { label: 'Draining', tone: 'warn' },
  drained: { label: 'Drained', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
  rolled_back: { label: 'Rolled back', tone: 'warn' },
  'rolled-back': { label: 'Rolled back', tone: 'warn' },
  lost: { label: 'Lost', tone: 'danger' },
  unhealthy: { label: 'Unhealthy', tone: 'danger' },
  unknown: { label: 'Unknown', tone: 'neutral' },
  error: { label: 'Error', tone: 'danger' },
  degraded: { label: 'Failing', tone: 'danger' },
  down: { label: 'Failing', tone: 'danger' },
  failing: { label: 'Failing', tone: 'danger' },
  backoff: { label: 'Restart pending', tone: 'warn' },
  never: { label: 'Not deployed', tone: 'neutral' },
}

/** Settled deployment outcomes where the rollout did not succeed. An automatic rollback is a failed rollout. */
export const unsuccessfulDeploymentStatuses = ['failed', 'rolled_back'] as const

export function isUnsuccessfulDeployment(status: string): boolean {
  return (unsuccessfulDeploymentStatuses as readonly string[]).includes(status)
}

export function statusDefinition(value: string): StatusDefinition | undefined {
  return statuses[value.toLowerCase()]
}

export function statusLabel(value: string): string | undefined {
  return statusDefinition(value)?.label
}
