type DeploymentSummary = {
  id: string
  status: string
  createdAt: Date | string
}

export function deploymentDetailState<T extends DeploymentSummary>(journal: T[], deploymentId: string) {
  const current = journal.find((deployment) => deployment.id === deploymentId)
  const superseding = current
    ? journal
        .filter((deployment) => deployment.id !== deploymentId && new Date(deployment.createdAt).getTime() > new Date(current.createdAt).getTime())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : undefined

  return {
    superseding,
    primaryRecovery: current?.status === 'failed' && !superseding,
  }
}

export type FailureLogInput = {
  /** The allocation the failure event names, when any. */
  allocationId?: string
  /** False when the allocation list could not be read, so absence proves nothing. */
  allocationsReadable: boolean
  /** Whether the named allocation is still in Trellis's list. */
  allocationFound: boolean
  lines: string[]
  /** A sanitized read error, when fetching logs failed. */
  error?: string | null
}

export type FailureLogState =
  | { kind: 'logs'; allocationHref: boolean }
  | { kind: 'empty'; allocationHref: true; message: string }
  | { kind: 'expired'; allocationHref: false; message: string }
  | { kind: 'unrecorded'; allocationHref: false; message: string }
  | { kind: 'error'; allocationHref: boolean; message: string }

/**
 * What a failed deployment can honestly say about its logs: output exists, the allocation produced
 * none, it has been garbage-collected (so the logs expired and its page would 404), or the failure
 * never named one. `allocationHref` says whether linking to the allocation page is safe.
 */
export function failureLogState(input: FailureLogInput): FailureLogState {
  if (!input.allocationId) return { kind: 'unrecorded', allocationHref: false, message: 'No allocation was recorded for this failure.' }
  if (!input.allocationsReadable) return { kind: 'error', allocationHref: true, message: `Allocation logs unavailable: ${input.error ?? 'Trellis could not be read.'}` }
  if (!input.allocationFound) return { kind: 'expired', allocationHref: false, message: 'The allocation is no longer available, so its logs have expired.' }
  if (input.lines.length) return { kind: 'logs', allocationHref: true }
  if (input.error) return { kind: 'error', allocationHref: true, message: `Allocation logs unavailable: ${input.error}` }
  return { kind: 'empty', allocationHref: true, message: 'The allocation produced no log output.' }
}

/** The newest successful release before this deployment, for "what changed since it last worked". */
export function previousSuccessfulRelease<T extends DeploymentSummary>(journal: T[], deploymentId: string): T | undefined {
  const current = journal.find((deployment) => deployment.id === deploymentId)
  if (!current) return undefined
  return journal
    .filter((deployment) => deployment.status === 'healthy' && new Date(deployment.createdAt).getTime() < new Date(current.createdAt).getTime())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
}
