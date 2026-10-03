'use client'

import { useMemo, useState } from 'react'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Rocket, X } from 'lucide-react'
import { DeploymentsTable } from '@/components/deployments-table'

type StatusFilter = 'all' | 'failed' | 'active' | 'healthy' | 'rolled_back'
const PAGE_SIZE = 20

interface DeploymentRow {
  deployment: {
    id: string
    status: string
    triggerType: string
    imageAfter: string
    imageBefore: string | null
    createdAt: Date
    startedAt: Date
    completedAt: Date | null
  }
  serviceName: string
  serviceSlug: string
  environmentName: string
  projectName: string
  projectSlug: string
  userName: string | null
}

interface DeploymentFiltersProps {
  items: DeploymentRow[]
  projects: string[]
  environments: string[]
  scope?: 'project' | 'organization'
}

export function DeploymentFilters({ items, projects, environments, scope = 'organization' }: DeploymentFiltersProps) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [envFilter, setEnvFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const activeStatuses = ['pending', 'planning', 'deploying', 'rolling_back']
    return items.filter((d) => {
      if (projectFilter !== 'all' && d.projectName !== projectFilter) return false
      if (envFilter !== 'all' && d.environmentName !== envFilter) return false
      if (status === 'active' && !activeStatuses.includes(d.deployment.status)) return false
      if (status === 'failed' && d.deployment.status !== 'failed') return false
      if (status === 'healthy' && d.deployment.status !== 'healthy') return false
      if (status === 'rolled_back' && d.deployment.status !== 'rolled_back') return false
      const haystack = `${d.serviceName} ${d.projectName} ${d.environmentName} ${d.deployment.imageAfter} ${d.userName ?? ''}`.toLowerCase()
      if (query && !haystack.includes(query.toLowerCase())) return false
      return true
    })
  }, [items, status, projectFilter, envFilter, query])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const showEnvironment = environments.length > 1

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          className="h-auto flex-col items-stretch py-3 sm:min-h-[52px] sm:flex-row sm:items-center sm:py-0"
          title={`${filtered.length} deployment${filtered.length === 1 ? '' : 's'}`}
          action={
            <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row">
              <div className="relative min-w-[240px] flex-1">
                <SearchInput value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search services, projects, images…" aria-label="Search deployments" className="h-10 pr-9 [&::-webkit-search-cancel-button]:appearance-none sm:h-8" />
                {query ? <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" onClick={() => { setQuery(''); setPage(1) }}><X className="size-3.5" /></button> : null}
              </div>
              {scope === 'organization' ? <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger aria-label="Filter by project" className="h-10 w-full sm:h-8 sm:w-[150px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end" className="w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => <SelectItem key={project} value={project}>{project}</SelectItem>)}
                </SelectContent>
              </Select> : null}
              {showEnvironment ? <Select value={envFilter} onValueChange={setEnvFilter}>
                <SelectTrigger aria-label="Filter by environment" className="h-10 w-full sm:h-8 sm:w-[160px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All environments</SelectItem>
                  {environments.map((environment) => <SelectItem key={environment} value={environment}>{environment}</SelectItem>)}
                </SelectContent>
              </Select> : null}
              <Select value={status} onValueChange={(value) => { setStatus(value as StatusFilter); setPage(1) }}>
                <SelectTrigger aria-label="Filter by deployment status" className="h-10 w-full text-sm sm:h-8 sm:w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent align="end" className="w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="all">All statuses</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="active">In progress</SelectItem><SelectItem value="healthy">Succeeded</SelectItem><SelectItem value="rolled_back">Rolled back</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Rocket className="h-4 w-4" />}
            title="No deployments match these filters"
            body="Try a different search or reset all filters."
            action={<Button variant="primary" onClick={() => { setStatus('all'); setProjectFilter('all'); setEnvFilter('all'); setQuery(''); setPage(1) }}>Clear filters</Button>}
          />
        ) : (
          <DeploymentsTable rows={visible} preset={scope === 'organization' ? 'organization' : 'project'} />
        )}
        {filtered.length > PAGE_SIZE ? <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-muted">
          <span>{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>‹ Previous</Button><Button size="sm" variant="ghost" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}>Next ›</Button></div>
        </div> : null}
      </Panel>
    </div>
  )
}
