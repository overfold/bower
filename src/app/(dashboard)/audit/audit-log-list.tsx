'use client'

import { useState } from 'react'
import { Bot, ChevronDown, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatRelativeTime, formatTimestamp } from '@/lib/format'

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

function DiffColumns({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details)
  if (entries.length === 0) return <p className="text-xs text-ink-muted">No additional details.</p>

  return (
    <div className="rounded-lg border border-line bg-sunken p-3">
      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Details</p>
      <dl className="mt-2 space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 font-mono text-[11.5px] text-ink-muted">{k}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words font-mono text-[11.5px] text-ink-soft">{typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}</dd>
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
                  {entry.userName ?? 'System'} · {formatTimestamp(entry.createdAt)} · {formatRelativeTime(entry.createdAt)}
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
              <div className="px-4 pb-4 pt-2">
                <DiffColumns details={entry.details as Record<string, unknown>} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
