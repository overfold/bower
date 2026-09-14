'use client'

import { useState } from 'react'
import { Bot, ChevronDown, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type AuditEntry = {
  id: string
  action: string
  resourceType: string
  resourceId: string
  details: Record<string, unknown>
  createdAt: Date | string
  userName: string | null
}

const actorIcons = {
  user: User,
  system: Bot,
} as const

function formatAbsTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatRelTime(date: Date | string): string {
  const d = new Date(date)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
  const diffMon = Math.floor(diffDay / 30)
  return `${diffMon} month${diffMon === 1 ? '' : 's'} ago`
}

function DiffColumns({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details)
  if (entries.length === 0) return <p className="text-xs text-ink-muted">No additional details.</p>

  return (
    <div className="rounded-lg border border-line bg-sunken p-3">
      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Details</p>
      <dl className="mt-2 space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="font-mono text-[11.5px] text-ink-muted">{k}</dt>
            <dd className="font-mono text-[11.5px] text-ink-soft">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function AuditLogList({ entries }: { entries: AuditEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(entries[0]?.id ?? null)

  return (
    <ul className="divide-y divide-line">
      {entries.map((entry) => {
        const isSystem = !entry.userName
        const Icon = isSystem ? actorIcons.system : actorIcons.user
        const expanded = openId === entry.id

        return (
          <li key={entry.id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpenId(expanded ? null : entry.id)}
              className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 ease-enter hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-muted">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-[12.5px] font-medium text-ink">
                    {entry.action}
                  </code>
                  {isSystem ? (
                    <Badge variant="info" className="text-2xs">system</Badge>
                  ) : null}
                </span>
                <span className="mt-1 block truncate text-[13px] text-ink-soft">
                  {entry.resourceType} / {entry.resourceId.slice(0, 8)}
                </span>
                <span className="mt-1 block text-xs text-ink-muted">
                  {entry.userName ?? 'System'} · {formatAbsTime(entry.createdAt)} · {formatRelTime(entry.createdAt)}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform duration-150 ease-enter',
                  expanded && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>
            {expanded ? (
              <div className="px-4 pb-4">
                <DiffColumns details={entry.details as Record<string, unknown>} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
