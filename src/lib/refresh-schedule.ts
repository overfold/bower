/** Pure scheduling rules for the page health poller, kept apart from React so they can be tested. */
export const REFRESH_FAST_MS = 5_000
export const REFRESH_IDLE_MS = 15_000
export const REFRESH_MAX_BACKOFF_MS = 60_000
/** A refresh slower than this is treated as a struggling server or network. */
export const REFRESH_SLOW_MS = 4_000

export function nextRefreshDelay({ fast, failures }: { fast: boolean; failures: number }): number {
  const base = fast ? REFRESH_FAST_MS : REFRESH_IDLE_MS
  return Math.min(REFRESH_MAX_BACKOFF_MS, base * 2 ** Math.min(failures, 4))
}

export type RefreshGuards = { hidden: boolean; offline: boolean; dialogOpen: boolean; unsavedChanges: boolean; editingText: boolean }

/** Refreshing never runs in a background tab, offline, behind an open dialog, or over unsaved edits. */
export function shouldRefresh(guards: RefreshGuards): boolean {
  return !guards.hidden && !guards.offline && !guards.dialogOpen && !guards.unsavedChanges && !guards.editingText
}

export function refreshFailed(durationMs: number, threwOrOffline: boolean): boolean {
  return threwOrOffline || durationMs > REFRESH_SLOW_MS
}
