import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Chip } from '@/components/ui/badge'
import { label } from '@/lib/labels'
import { statusDefinition } from '@/lib/status'
import type { Tone } from '@/lib/tone'
export type { Tone } from '@/lib/tone'

const toneDot: Record<Tone, string> = {
  brand: 'bg-brand-500',
  success: 'bg-ok-500',
  warn: 'bg-warn-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  neutral: 'bg-ink-faint',
}

export function Dot({ tone = 'neutral', pulse }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
      {pulse ? (
        <span
          className={cn('absolute inset-0 animate-ping rounded-full opacity-60', toneDot[tone])}
          style={{ animationDuration: '1.6s' }}
        />
      ) : null}
      <span className={cn('relative h-1.5 w-1.5 rounded-full', toneDot[tone])} />
    </span>
  )
}

export { Chip }

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const definition = statusDefinition(status)
  const inProgress = definition?.inProgress ?? false
  const tone = definition?.tone ?? 'neutral'

  return (
    <Chip tone={tone} className={className}>
      {inProgress ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Dot tone={tone} />}
      <span>{definition?.label ?? label(status)}</span>
    </Chip>
  )
}

export function DeploymentStatus({ status, className }: { status: string; className?: string }) {
  const normalized = status.toLowerCase()
  const definition = statusDefinition(normalized)
  const inProgress = definition?.inProgress ?? false
  const displayStatus = inProgress ? 'In progress' : normalized === 'healthy' ? 'Succeeded' : definition?.label ?? label(normalized)
  const tone: Tone = definition?.tone ?? 'neutral'
  return <Chip tone={tone} className={className}>{inProgress ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Dot tone={tone} />}<span>{displayStatus}</span></Chip>
}

export function AllocationStatus({ phase, health, className }: { phase: string; health?: string | null; className?: string }) {
  return <StatusDot status={phase === 'running' && health ? health : phase} className={className} />
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-code text-ink-soft", className)}>{children}</span>
  )
}

export function Meter({ value, tone = 'brand', label }: { value: number; tone?: Tone; label?: string }) {
  const resolved: Tone = tone === 'brand' && value >= 85 ? 'danger' : tone === 'brand' && value >= 70 ? 'warn' : tone
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-full max-w-[88px] overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={`${label ?? 'Usage'} ${value}%`}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 ease-move', toneDot[resolved])}
          style={{ width: `${Math.min(100, Math.max(2, value))}%` }}
        />
      </div>
      <span className="nums w-8 shrink-0 text-right text-xs text-ink-muted">{value}%</span>
    </div>
  )
}
