'use client'

import * as React from 'react'
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toneClasses, toneIconClasses, type Tone } from '@/lib/tone'

export const TOAST_DURATION_MS = 5000
export const TOAST_EXIT_MS = 150
export const TOAST_LIMIT = 4

export type ToastMessage = {
  id: string
  title: string
  description?: string
  tone: Tone
}

export type ToastEntry = ToastMessage & { closing: boolean }

type FeedbackContextValue = {
  toast: (message: Omit<ToastMessage, 'id'>) => void
  dismiss: (id: string) => void
}

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null)

const toneIcons: Record<Tone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  danger: CircleAlert,
  warn: TriangleAlert,
  info: Info,
  neutral: Info,
  brand: Info,
}

type AutoDismiss = { handle: ReturnType<typeof setTimeout> | null; remaining: number; startedAt: number }

// Owns the toast list and its timers outside React, so the provider stays thin
// and the timing rules can be exercised directly. Danger toasts never get a
// timer; the others pause with the remaining time while the stack is hovered or
// focused. Dismissed toasts stay listed as `closing` until their exit animation ends.
export function createToastStore({
  duration = TOAST_DURATION_MS,
  exitDuration = TOAST_EXIT_MS,
  limit = TOAST_LIMIT,
  reducedMotion = () => false,
}: { duration?: number; exitDuration?: number; limit?: number; reducedMotion?: () => boolean } = {}) {
  let toasts: ToastEntry[] = []
  let paused = false
  let sequence = 0
  const timers = new Map<string, AutoDismiss>()
  const exits = new Map<string, ReturnType<typeof setTimeout>>()
  const listeners = new Set<() => void>()

  const update = (next: ToastEntry[]) => {
    toasts = next
    listeners.forEach((listener) => listener())
  }
  const start = (id: string, timer: AutoDismiss) => {
    timer.startedAt = Date.now()
    timer.handle = setTimeout(() => dismiss(id), timer.remaining)
  }
  const stop = (timer: AutoDismiss) => {
    if (timer.handle === null) return
    clearTimeout(timer.handle)
    timer.handle = null
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
  }
  const clearTimers = (id: string) => {
    const timer = timers.get(id)
    if (timer?.handle) clearTimeout(timer.handle)
    timers.delete(id)
    const exit = exits.get(id)
    if (exit) clearTimeout(exit)
    exits.delete(id)
  }
  const remove = (ids: string[]) => {
    ids.forEach(clearTimers)
    update(toasts.filter((toast) => !ids.includes(toast.id)))
  }

  function dismiss(id: string) {
    const entry = toasts.find((toast) => toast.id === id)
    if (!entry || entry.closing) return
    if (reducedMotion() || exitDuration <= 0) return remove([id])
    clearTimers(id)
    update(toasts.map((toast) => toast.id === id ? { ...toast, closing: true } : toast))
    exits.set(id, setTimeout(() => remove([id]), exitDuration))
  }

  function push(message: Omit<ToastMessage, 'id'>) {
    const id = `toast-${++sequence}`
    const open = toasts.filter((toast) => !toast.closing)
    const overflow = open.slice(0, Math.max(0, open.length - limit + 1)).map((toast) => toast.id)
    overflow.forEach(clearTimers)
    update([...toasts.filter((toast) => !overflow.includes(toast.id)), { ...message, id, closing: false }])
    if (message.tone !== 'danger') {
      const timer: AutoDismiss = { handle: null, remaining: duration, startedAt: 0 }
      timers.set(id, timer)
      if (!paused) start(id, timer)
    }
    return id
  }

  function setPaused(next: boolean) {
    if (paused === next) return
    paused = next
    timers.forEach((timer, id) => next ? stop(timer) : start(id, timer))
  }

  function destroy() {
    ;[...timers.keys(), ...exits.keys()].forEach(clearTimers)
  }

  return {
    push,
    dismiss,
    setPaused,
    destroy,
    getSnapshot: () => toasts,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [store] = React.useState(() => createToastStore({ reducedMotion: prefersReducedMotion }))
  const toasts = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const value = React.useMemo<FeedbackContextValue>(() => ({ toast: (message) => { store.push(message) }, dismiss: store.dismiss }), [store])

  React.useEffect(() => () => store.destroy(), [store])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={store.dismiss} onPauseChange={store.setPaused} />
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const feedback = React.useContext(FeedbackContext)
  if (!feedback) throw new Error('useFeedback must be used within FeedbackProvider.')
  return feedback
}

// One right-aligned column holding two always-mounted sibling live regions:
// errors interrupt (assertive), everything else waits (polite). The toasts
// themselves carry no role, so nothing competes with the region's politeness.
export function ToastViewport({ toasts, onDismiss, onPauseChange }: { toasts: ToastEntry[]; onDismiss: (id: string) => void; onPauseChange?: (paused: boolean) => void }) {
  const ref = React.useRef<HTMLElement>(null)
  const hovered = React.useRef(false)
  const focused = React.useRef(false)
  const sync = React.useCallback(() => onPauseChange?.(hovered.current || focused.current), [onPauseChange])

  // A dismissed toast can take the focus or the pointer with it without firing
  // blur or pointerleave, which would leave the timers paused.
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    focused.current = node.contains(document.activeElement)
    hovered.current = hovered.current && node.matches(':hover')
    sync()
  }, [toasts, sync])

  const render = (toast: ToastEntry) => <FeedbackToast key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
  return (
    <section
      ref={ref}
      aria-label="Status messages"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-[22rem] flex-col items-end"
      onPointerEnter={() => { hovered.current = true; sync() }}
      onPointerLeave={() => { hovered.current = false; sync() }}
      onFocus={() => { focused.current = true; sync() }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { focused.current = false; sync() } }}
    >
      <div aria-live="polite" className="flex w-full flex-col items-end gap-2">{toasts.filter((toast) => toast.tone !== 'danger').map(render)}</div>
      <div aria-live="assertive" className="flex w-full flex-col items-end gap-2 [&:not(:empty)]:mt-2">{toasts.filter((toast) => toast.tone === 'danger').map(render)}</div>
    </section>
  )
}

function FeedbackToast({ toast, onDismiss }: { toast: ToastEntry; onDismiss: () => void }) {
  const Icon = toneIcons[toast.tone]
  return (
    <div
      data-state={toast.closing ? 'closed' : 'open'}
      className={cn(
        'pointer-events-auto flex w-fit max-w-full items-start gap-2.5 rounded-lg border border-line bg-surface py-2.5 pl-3 pr-2 text-ink shadow-raised ease-enter',
        toast.closing ? 'animate-out fade-out-0 duration-150 [--tw-animation-fill-mode:forwards]' : 'animate-in fade-in-0 slide-in-from-bottom-[6px] duration-200',
      )}
    >
      <Icon className={cn('mt-px h-4 w-4 shrink-0', toneIconClasses[toast.tone])} aria-hidden />
      <div className="min-w-0 flex-1 break-words">
        <p className="text-sm font-medium leading-snug text-ink">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-xs text-ink-muted">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="-my-px ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors duration-150 ease-enter hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label={`Dismiss: ${toast.title}`}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

export function InlineNotice({ tone = 'info', children, action, className, icon }: { tone?: Tone; children: React.ReactNode; action?: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  const Icon = toneIcons[tone]
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-lg border px-3.5 py-3 text-sm leading-relaxed", toneClasses[tone], className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <div className="flex min-w-0 items-start gap-2.5">{icon ?? <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}<div className="min-w-0">{children}</div></div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  return children ? <p className="text-xs text-danger-500" role="alert">{children}</p> : null
}

type PageBannerContent = { tone?: Tone; title: string; children?: React.ReactNode; action?: React.ReactNode }

// Banners describe live conditions, so they show for exactly as long as the
// condition holds. Only a banner the user may hide for the session opts in,
// and it needs a stable id: a title can be shared by unrelated recurrences.
export type PageBannerProps = PageBannerContent & ({ dismissible?: false; id?: undefined } | { dismissible: true; id: string })

export function PageBanner({ dismissible, id, ...content }: PageBannerProps) {
  return dismissible && id ? <DismissiblePageBanner id={id} {...content} /> : <PageBannerView {...content} />
}

const dismissedBanners = new Set<string>()
const bannerListeners = new Set<() => void>()
const subscribeToBanners = (listener: () => void) => {
  bannerListeners.add(listener)
  return () => { bannerListeners.delete(listener) }
}
const isBannerDismissed = (key: string) => {
  if (dismissedBanners.has(key)) return true
  try { return sessionStorage.getItem(key) !== null } catch { return false }
}

function DismissiblePageBanner({ id, ...content }: PageBannerContent & { id: string }) {
  const key = `bower.banner.${id}`
  // sessionStorage is client-only, so the server and hydration render nothing
  // and the client then shows the banner only if it wasn't dismissed. A
  // dismissed banner is never painted and then removed.
  const dismissed = React.useSyncExternalStore(subscribeToBanners, () => isBannerDismissed(key), () => true)
  if (dismissed) return null
  return <PageBannerView {...content} onDismiss={() => {
    dismissedBanners.add(key)
    try { sessionStorage.setItem(key, '1') } catch { /* Storage may be blocked; the in-memory set still hides it. */ }
    bannerListeners.forEach((listener) => listener())
  }} />
}

export function PageBannerView({ tone = 'warn', title, children, action, onDismiss }: PageBannerContent & { onDismiss?: () => void }) {
  const Icon = toneIcons[tone]
  return (
    <div className={cn("flex items-start gap-3 border-b px-4 py-3 text-sm leading-relaxed sm:px-6 lg:px-8", toneClasses[tone])} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-x-4 gap-y-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><span className="font-semibold">{title}</span>{children ? <span className="ml-1">{children}</span> : null}</div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {onDismiss ? <button type="button" onClick={onDismiss} className="rounded-md p-1 transition-colors duration-150 ease-enter hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={`Dismiss: ${title}`}><X className="h-4 w-4" aria-hidden /></button> : null}
    </div>
  )
}
