'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Rocket } from 'lucide-react'
import { DeploymentStatus, StatusDot } from '@/components/status'
import { Time } from '@/components/time'
import { IconButton } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { markNotificationsSeenAction } from '@/lib/actions/notifications'
import { notificationHref, notificationsButtonLabel, seenThrough, unreadBadgeText, type NotificationFeed } from '@/lib/notification-feed'
import { cn } from '@/lib/utils'

const REFRESH_INTERVAL_MS = 60_000

async function fetchFeed(signal?: AbortSignal): Promise<NotificationFeed> {
  const response = await fetch('/api/notifications', { cache: 'no-store', signal, headers: { accept: 'application/json' } })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Notifications unavailable.')
  return response.json()
}

/** Polls the feed every minute while the tab is visible, and again whenever the window regains focus. */
function useNotificationFeed(initial: NotificationFeed | null) {
  const [feed, setFeed] = useState(initial)
  const [failed, setFailed] = useState(initial === null)
  const [previousInitial, setPreviousInitial] = useState(initial)
  const controller = useRef<AbortController | null>(null)

  // A server refresh of the layout (router.refresh) brings a newer feed.
  if (initial !== previousInitial) {
    setPreviousInitial(initial)
    if (initial) {
      setFeed(initial)
      setFailed(false)
    }
  }

  const refresh = useCallback(async () => {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    try {
      const next = await fetchFeed(current.signal)
      if (current.signal.aborted) return
      setFeed(next)
      setFailed(false)
    } catch {
      if (!current.signal.aborted) setFailed(true)
    }
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const stop = () => { if (timer !== null) clearInterval(timer); timer = null }
    const start = () => { stop(); timer = setInterval(refresh, REFRESH_INTERVAL_MS) }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') return stop()
      void refresh()
      start()
    }
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh() }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      stop()
      controller.current?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { feed, setFeed, failed, refresh }
}

export function NotificationsMenu({ initial }: { initial: NotificationFeed | null }) {
  const { feed, setFeed, failed, refresh } = useNotificationFeed(initial)
  const unreadCount = feed?.unreadCount ?? 0
  const badge = unreadBadgeText(unreadCount)
  const label = notificationsButtonLabel(unreadCount)

  // Opening the menu marks everything shown as read. Rows keep their unread marker until it closes.
  function handleOpenChange(open: boolean) {
    if (!open) {
      setFeed((current) => current && {
        ...current,
        items: current.items.map((item) => ({ ...item, unread: Date.parse(item.occurredAt) > Date.parse(current.lastSeenAt) })),
      })
      return
    }
    if (!feed || feed.unreadCount === 0) return
    const through = seenThrough(feed.items)
    if (!through) return
    setFeed({ ...feed, unreadCount: 0, lastSeenAt: through })
    // Refresh either way: it restores the badge on failure and supersedes a poll that raced the update.
    void markNotificationsSeenAction(through).then(refresh, refresh)
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <IconButton
          label={label}
          className="relative h-10 w-10 shrink-0 border-line bg-surface shadow-card hover:border-line-strong hover:bg-surface sm:h-8 sm:w-8 [&_svg]:size-4 sm:[&_svg]:size-3.5"
        >
          <Bell aria-hidden />
          {badge ? (
            <span aria-hidden className="nums absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-2xs font-semibold leading-none text-white ring-2 ring-canvas">
              {badge}
            </span>
          ) : null}
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} collisionPadding={16} className="flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col p-0">
        <DropdownMenuLabel className="px-3.5 py-2.5">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-0 my-0" />
        {failed && feed ? (
          <p role="status" className="border-b border-line bg-sunken px-3.5 py-2 text-xs text-ink-muted">Couldn&apos;t refresh. Showing earlier results.</p>
        ) : null}
        {feed && feed.items.length > 0 ? (
          <div className="max-h-[min(26rem,65vh)] overflow-y-auto p-1.5">
            {feed.items.map((item) => (
              <DropdownMenuItem key={`${item.kind}-${item.id}`} asChild className="items-start gap-2.5 px-2 py-2">
                <Link href={notificationHref(item)}>
                  <span aria-hidden className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', item.unread ? 'bg-brand-500' : 'bg-transparent')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      {item.unread ? <span className="sr-only">Unread: </span> : null}
                      <span className={cn('min-w-0 truncate text-sm text-ink', item.unread ? 'font-semibold' : 'font-medium')} title={item.serviceName}>{item.serviceName}</span>
                      <span className="ml-auto shrink-0 text-xs text-ink-muted"><Time value={item.occurredAt} /></span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-muted" title={`${item.projectName} · ${item.environmentName}`}>
                      {item.projectName} · {item.environmentName}
                    </span>
                    {item.kind === 'service' ? <>
                      <span className="mt-1.5 flex items-center gap-2"><StatusDot status={item.status} /></span>
                      <span className="mt-1 block line-clamp-2 break-words text-xs text-ink-muted" title={item.cause}>{item.cause}</span>
                    </> : <span className="mt-1.5 flex items-center gap-2">
                      <DeploymentStatus status={item.status} />
                      {item.triggeredByMe ? <span className="text-xs text-ink-muted">Your deploy</span> : null}
                    </span>}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ) : !feed ? (
          <div role="status" className="px-3.5 py-4 text-sm">
            <p className="text-ink-soft">Couldn&apos;t load notifications.</p>
            <p className="mt-0.5 text-xs text-ink-muted">Bower will try again shortly.</p>
            <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void refresh() }} className="-mx-2 mt-2 w-fit text-link">
              Try again
            </DropdownMenuItem>
          </div>
        ) : (
          <EmptyState
            icon={<Rocket className="size-4" />}
            title="No activity yet"
            body="Failures in your projects and the results of your deploys appear here."
          />
        )}
        <DropdownMenuSeparator className="mx-0 my-0" />
        <div className="p-1.5">
          <DropdownMenuItem asChild className="justify-center text-ink-soft">
            <Link href="/deployments">View all deployments</Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
