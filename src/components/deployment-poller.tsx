'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useTransition } from 'react'
import { nextRefreshDelay, refreshFailed, shouldRefresh } from '@/lib/refresh-schedule'

function currentGuards() {
  const main = document.getElementById('main-content')
  const active = document.activeElement
  return {
    hidden: document.visibilityState === 'hidden',
    offline: navigator.onLine === false,
    dialogOpen: Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')),
    unsavedChanges: Number(main?.dataset.unsaved ?? 0) > 0,
    editingText: active instanceof HTMLElement && (active.isContentEditable || ['INPUT', 'TEXTAREA'].includes(active.tagName) && !(active instanceof HTMLInputElement && ['checkbox', 'radio', 'button', 'submit'].includes(active.type))),
  }
}

/**
 * Keeps server-rendered health fresh while the page is visible: every 15 seconds, or every 5 while a
 * deployment is in progress. It pauses in background tabs, behind dialogs and over unsaved edits, and
 * backs off (up to a minute) when refreshes are slow or the browser is offline.
 */
export function DeploymentPoller({ active }: { active: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const failures = useRef(0)
  const startedAt = useRef<number | null>(null)

  // The transition stays pending until the server render arrives, so its duration is the health signal.
  useEffect(() => {
    if (pending) startedAt.current = Date.now()
    else if (startedAt.current !== null) {
      failures.current = refreshFailed(Date.now() - startedAt.current, false) ? failures.current + 1 : 0
      startedAt.current = null
    }
  }, [pending])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    const schedule = () => {
      if (stopped) return
      timer = setTimeout(tick, nextRefreshDelay({ fast: active, failures: failures.current }))
    }
    const tick = () => {
      if (!shouldRefresh(currentGuards())) {
        if (navigator.onLine === false) failures.current += 1
        return schedule()
      }
      startTransition(() => router.refresh())
      schedule()
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (timer) clearTimeout(timer)
      failures.current = 0
      tick()
    }
    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stopped = true; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [active, router])

  return null
}
