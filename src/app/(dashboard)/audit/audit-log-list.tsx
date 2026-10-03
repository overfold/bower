'use client'

import { useMemo, useState } from 'react'
import { Bot, ChevronDown, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Time } from '@/components/time'
import { cn } from '@/lib/utils'
import { auditActionSentence, auditResourceName, label } from '@/lib/labels'

const PAGE_SIZE = 25

type AuditEntry = {
  id: string
  action: string
  resourceType: string
  resourceId: string
  resourceName?: string
  details: Record<string, unknown>
  createdAt: Date | string
  userName: string | null
}

const actorIcons = {
  user: User,
  system: Bot,
} as const

function DiffColumns({ details }: { details: Record<string, unknown> }) {
  const before = details.before && typeof details.before === 'object' ? details.before as Record<string, unknown> : null
  const after = details.after && typeof details.after === 'object' ? details.after as Record<string, unknown> : null
  const scalarDiff = 'before' in details && 'after' in details && !(before && after)
  const diffKeys = before && after ? [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])) : []
  const entries = Object.entries(details).filter(([key]) => !((scalarDiff || (before && after)) && (key === 'before' || key === 'after')))
  if (entries.length === 0 && diffKeys.length === 0 && !scalarDiff) return <p className="text-xs text-ink-muted">No additional details.</p>

  return (
    <div className="rounded-lg border border-line bg-sunken p-3">
      <p className="overline">Details</p>
      <dl className="mt-2 grid max-w-3xl grid-cols-[minmax(8rem,0.4fr)_minmax(0,1fr)] gap-x-4 gap-y-2">
        {scalarDiff ? <><dt className="text-xs text-ink-muted">Change</dt><dd className="font-mono text-xs"><span className="text-ink-muted">{String(details.before ?? '—')}</span><span className="mx-2 text-ink-muted">→</span>{String(details.after ?? '—')}</dd></> : null}
        {diffKeys.map((key) => <div key={`diff-${key}`} className="contents">
          <dt className="text-xs text-ink-muted">{label(key)}</dt>
          <dd className="min-w-0 break-words font-mono text-code">
            <span className="text-ink-muted">{typeof before![key] === 'object' ? JSON.stringify(before![key]) : String(before![key] ?? '—')}</span>
            <span className="mx-2 text-ink-muted" aria-label="changed to">→</span>
            <span className="text-ink">{typeof after![key] === 'object' ? JSON.stringify(after![key]) : String(after![key] ?? '—')}</span>
          </dd>
        </div>)}
        {entries.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-xs text-ink-muted">{label(k)}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs text-ink-soft">{typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function AuditLogList({ entries, now }: { entries: AuditEntry[]; now: number }) {
  const [openId, setOpenId] = useState<string | null>(entries[0]?.id ?? null)
  const [actor, setActor] = useState('all')
  const [action, setAction] = useState('all')
  const [resource, setResource] = useState('all')
  const [date, setDate] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const actors = [...new Set(entries.map((entry) => entry.userName ?? 'System'))].sort()
  const actions = [...new Set(entries.map((entry) => entry.action))].sort()
  const resources = [...new Set(entries.map((entry) => entry.resourceType))].sort()
  const filtered = useMemo(() => entries.filter((entry) => {
    if (actor !== 'all' && (entry.userName ?? 'System') !== actor) return false
    if (action !== 'all' && entry.action !== action) return false
    if (resource !== 'all' && entry.resourceType !== resource) return false
    if (date !== 'all' && now - new Date(entry.createdAt).getTime() > Number(date) * 86_400_000) return false
    const name = auditResourceName(entry)
    return !query || `${entry.action} ${entry.resourceType} ${entry.resourceId} ${entry.userName ?? 'System'} ${name ?? ''}`.toLowerCase().includes(query.toLowerCase())
  }), [entries, actor, action, resource, date, query, now])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <Panel>
      <PanelHeader title={`${filtered.length} event${filtered.length === 1 ? '' : 's'}`} hint="Retained for 365 days" />
      <div className="flex flex-wrap gap-2 border-b border-line p-3 [&_button[role=combobox]]:w-auto">
        <SearchInput value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search" aria-label="Search audit log" />
        <AuditSelect label="actor" value={actor} setValue={setActor} options={actors} />
        <AuditSelect label="action" value={action} setValue={setAction} options={actions} />
        <AuditSelect label="resource" value={resource} setValue={setResource} options={resources} />
        <Select value={date} onValueChange={setDate}><SelectTrigger aria-label="Filter by date"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any date</SelectItem><SelectItem value="1">Last 24 hours</SelectItem><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem></SelectContent></Select>
      </div>
      <ul className="divide-y divide-line">
      {visible.map((entry) => {
        const isSystem = !entry.userName
        const Icon = isSystem ? actorIcons.system : actorIcons.user
        const expanded = openId === entry.id

        return (
          <li key={entry.id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpenId(expanded ? null : entry.id)}
              className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 ease-enter hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-muted">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{entry.userName ?? 'System'} {auditActionSentence(entry.action, auditResourceName(entry), entry.details)}</span>
                <span className="mt-1 block truncate text-xs text-ink-muted">
                  <span className="font-mono">{entry.action}</span> · <Time value={entry.createdAt} mode="auto" />
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
      {filtered.length === 0 ? <p className="px-4 py-10 text-center text-sm text-ink-muted">No events match these filters.</p> : null}
      {filtered.length > PAGE_SIZE ? <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-muted"><span>Page {currentPage} of {pageCount}</span><div className="flex gap-2"><Button size="sm" variant="ghost" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="ghost" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div> : null}
    </Panel>
  )
}

function AuditSelect({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: string[] }) {
  return <Select value={value} onValueChange={setValue}><SelectTrigger aria-label={`Filter by ${label}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All {label}s</SelectItem>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
}
