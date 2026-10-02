'use client'

import * as React from 'react'
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toneClasses, type Tone } from '@/lib/tone'

export type FeedbackTone = Tone | 'error' | 'warning'

function normalizeTone(tone: FeedbackTone): Tone {
  return tone === 'error' ? 'danger' : tone === 'warning' ? 'warn' : tone
}

type ToastMessage = {
  id: string
  title: string
  description?: string
  tone: FeedbackTone
}

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

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = React.useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const toast = React.useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current.slice(-3), { ...message, id }])
    timers.current.set(id, setTimeout(() => dismiss(id), 5000))
  }, [dismiss])

  React.useEffect(() => () => {
    timers.current.forEach(clearTimeout)
  }, [])

  return (
    <FeedbackContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite" aria-label="Notifications">
        {toasts.map((message) => <FeedbackToast key={message.id} message={message} onDismiss={() => dismiss(message.id)} />)}
      </div>
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const feedback = React.useContext(FeedbackContext)
  if (!feedback) throw new Error('useFeedback must be used within FeedbackProvider.')
  return feedback
}

function FeedbackToast({ message, onDismiss }: { message: ToastMessage; onDismiss: () => void }) {
  const tone = normalizeTone(message.tone)
  const Icon = toneIcons[tone]
  return (
    <div className={cn('pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-raised', toneClasses[tone])} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="font-semibold">{message.title}</p>
        {message.description ? <p className="mt-0.5 opacity-90">{message.description}</p> : null}
      </div>
      <button type="button" onClick={onDismiss} className="rounded-md p-1 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current" aria-label={`Dismiss: ${message.title}`}>
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

export function InlineNotice({ tone = 'info', children, action, className, icon }: { tone?: FeedbackTone | 'neutral' | 'warn' | 'danger' | 'brand'; children: React.ReactNode; action?: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  const normalizedTone = normalizeTone(tone)
  const Icon = toneIcons[normalizedTone]
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-lg border px-3.5 py-3 text-sm leading-relaxed", toneClasses[normalizedTone], className)} role={normalizedTone === 'danger' ? 'alert' : 'status'}>
      <div className="flex min-w-0 items-start gap-2.5">{icon ?? <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}<div className="min-w-0">{children}</div></div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  return children ? <p className="text-xs text-danger-500" role="alert">{children}</p> : null
}

export function PageBanner({ id, tone = 'warning', title, children }: { id?: string; tone?: FeedbackTone; title: string; children?: React.ReactNode }) {
  const [dismissed, setDismissed] = React.useState(false)
  const key = `bower.banner.${id ?? title}`
  React.useEffect(() => {
    try { if (sessionStorage.getItem(key)) requestAnimationFrame(() => setDismissed(true)) } catch { /* Storage may be blocked. */ }
  }, [key])
  const normalized = normalizeTone(tone)
  const Icon = toneIcons[normalized]
  if (dismissed) return null
  return (
    <div className={cn("flex items-start gap-3 border-b px-4 py-3 text-sm leading-relaxed sm:px-6 lg:px-8", toneClasses[normalized])} role={normalized === 'danger' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1"><span className="font-semibold">{title}</span>{children ? <span className="ml-1">{children}</span> : null}</div>
      <button type="button" onClick={() => { setDismissed(true); try { sessionStorage.setItem(key, '1') } catch { /* Storage may be blocked. */ } }} className="rounded-md p-1 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current" aria-label={`Dismiss: ${title}`}><X className="h-4 w-4" aria-hidden /></button>
    </div>
  )
}
