import { Time } from '@/components/time'
import type { DateValue } from '@/lib/format'
import { cn } from '@/lib/utils'

export function ActivityKeyLine({ action, createdAt, className }: { action: string; createdAt: DateValue; className?: string }) {
  return (
    <span className={cn('block truncate font-sans text-xs text-ink-muted', className)}>
      <span className="font-mono">{action}</span>{' · '}<Time value={createdAt} mode="auto" />
    </span>
  )
}
