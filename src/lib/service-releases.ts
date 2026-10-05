import type { TrellisJobSpec } from '@/types/trellis'

export type ReleaseIdentity = {
  id: string
  status: string
  trellisJobName: string | null
  trellisIncarnation?: string | null
  trellisVersion: number | null
  trellisRevision: number | null
  jobSpec: unknown
  planDiff?: unknown
}

export type RuntimeIdentity = { name: string; incarnation?: string; version: number; revision: number }

/** Stored plans retain the exact artifacts even after Trellis deletes a track. */
export function releaseImagePins(jobSpec: unknown, planDiff: unknown): Record<string, string> | undefined {
  const spec = jobSpec as TrellisJobSpec | null
  const plan = planDiff as { resolved_images?: Record<string, string> } | null
  if (!spec?.task_groups?.length) return undefined
  const pins: Record<string, string> = {}
  for (const group of spec.task_groups) {
    for (const task of group.tasks) {
      const pinned = plan?.resolved_images?.[task.image] ?? (task.image.includes('@sha256:') ? task.image : undefined)
      if (!pinned) return undefined
      pins[task.image] = pinned
    }
  }
  return pins
}

/** Match the journal to what Trellis is actually serving, rather than inferring it from status. */
export function runningRelease<T extends ReleaseIdentity>(journal: T[], runtime: RuntimeIdentity | null): T | undefined {
  if (!runtime) return undefined
  return journal.find((release) => release.trellisJobName === runtime.name
    && (!runtime.incarnation || release.trellisIncarnation === runtime.incarnation)
    && release.trellisVersion === runtime.version
    && release.trellisRevision === runtime.revision)
}

/** Successful releases strictly older than the active journal entry. */
export function earlierSuccessfulReleases<T extends ReleaseIdentity>(journal: T[], active: T | undefined): T[] {
  if (!active) return []
  const activeIndex = journal.findIndex((release) => release.id === active.id)
  if (activeIndex < 0) return []
  return journal.slice(activeIndex + 1).filter((release) => release.status === 'healthy' && releaseImagePins(release.jobSpec, release.planDiff))
}
