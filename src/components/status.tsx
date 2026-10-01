import { cn } from '@/lib/utils'
import { badgeVariants } from '@/components/ui/badge'

export type Tone = 'brand' | 'warn' | 'danger' | 'info' | 'neutral'

const toneChip: Record<Tone, string> = {
  brand: badgeVariants({ variant: 'success' }),
  warn: badgeVariants({ variant: 'warning' }),
  danger: badgeVariants({ variant: 'danger' }),
  info: badgeVariants({ variant: 'info' }),
  neutral: badgeVariants({ variant: 'secondary' }),
}

const toneDot: Record<Tone, string> = {
  brand: 'bg-brand-500',
  warn: 'bg-warn-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  neutral: 'bg-ink-faint',
}

const statusTone: Record<string, Tone> = {
  healthy: 'brand',
  running: 'brand',
  deploying: 'warn',
  pending: 'neutral',
  planning: 'neutral',
  starting: 'warn',
  placed: 'warn',
  stopping: 'neutral',
  stopped: 'neutral',
  completed: 'neutral',
  dead: 'neutral',
  draining: 'warn',
  failed: 'danger',
  rolled_back: 'info',
  'rolled-back': 'info',
  lost: 'danger',
  unhealthy: 'danger',
  unknown: 'neutral',
  error: 'danger',
  degraded: 'warn',
  never: 'neutral',
}

const pulsingStatuses = new Set(['deploying', 'pending', 'planning', 'starting', 'placed', 'draining'])

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

export function Chip({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(toneChip[tone], className)}>
      {children}
    </span>
  )
}

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const tone = statusTone[status] ?? 'neutral'
  const pulse = pulsingStatuses.has(status)

  return (
    <Chip tone={tone} className={className}>
      <Dot tone={tone} pulse={pulse} />
      <span className="capitalize">{status.replace(/_/g, ' ')}</span>
    </Chip>
  )
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono text-[12.5px] text-ink-soft', className)}>{children}</span>
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
