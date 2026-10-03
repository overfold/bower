'use client'

import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { DeploymentsTable, type DeploymentsTableRow } from '@/components/deployments-table'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 20

export function RevisionsToolbar({ items }: { items: DeploymentsTableRow[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => items.filter((item) => {
    const activeStatuses = ['pending', 'planning', 'deploying', 'rolling_back']
    if (status === 'active' ? !activeStatuses.includes(item.deployment.status) : status !== 'all' && item.deployment.status !== status) return false
    return !query || `${item.revision ?? ''} ${item.deployment.imageAfter} ${item.userName ?? ''}`.toLowerCase().includes(query.toLowerCase())
  }), [items, query, status])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return <Panel>
    <PanelHeader className="h-auto flex-col items-stretch py-3 sm:min-h-[52px] sm:flex-row sm:items-center sm:py-0" title={`${filtered.length} deployment${filtered.length === 1 ? '' : 's'}`} action={<div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row">
      <SearchInput value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} aria-label="Search revisions and images" />
      <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1) }}><SelectTrigger aria-label="Filter by deployment status" className="h-10 w-full text-sm sm:h-8 sm:w-[150px]"><SelectValue /></SelectTrigger><SelectContent align="end"><SelectItem value="all">All statuses</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="active">In progress</SelectItem><SelectItem value="healthy">Succeeded</SelectItem><SelectItem value="rolled_back">Rolled back</SelectItem></SelectContent></Select>
    </div>} />
    {visible.length ? <DeploymentsTable rows={visible} preset="service-history" /> : <EmptyState icon={<History className="h-4 w-4" />} title="No deployments match these filters" body="Try a different search or status." action={<Button variant="primary" onClick={() => { setQuery(''); setStatus('all'); setPage(1) }}>Clear filters</Button>} />}
    {filtered.length > PAGE_SIZE ? <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-muted"><span>{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span><div className="flex gap-2"><Button size="sm" variant="ghost" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>‹ Previous</Button><Button size="sm" variant="ghost" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}>Next ›</Button></div></div> : null}
  </Panel>
}
