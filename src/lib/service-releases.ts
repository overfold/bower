export type ReleaseIdentity = {
  id: string
  status: string
  trellisJobName: string | null
  trellisVersion: number | null
  trellisRevision: number | null
  jobSpec: unknown
}

export type RuntimeIdentity = { name: string; version: number; revision: number }

/** Match the journal to what Trellis is actually serving, rather than inferring it from status. */
export function runningRelease<T extends ReleaseIdentity>(journal: T[], runtime: RuntimeIdentity | null): T | undefined {
  if (!runtime) return undefined
  return journal.find((release) => release.trellisJobName === runtime.name
    && release.trellisVersion === runtime.version
    && release.trellisRevision === runtime.revision)
}

/** Successful releases strictly older than the active journal entry. */
export function earlierSuccessfulReleases<T extends ReleaseIdentity>(journal: T[], active: T | undefined): T[] {
  if (!active) return []
  const activeIndex = journal.findIndex((release) => release.id === active.id)
  if (activeIndex < 0) return []
  return journal.slice(activeIndex + 1).filter((release) => release.status === 'healthy' && release.jobSpec)
}
