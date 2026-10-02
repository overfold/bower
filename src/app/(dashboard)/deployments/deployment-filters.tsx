'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { StatusDot, Mono } from '@/components/status'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Time } from '@/components/time'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  UserIcon,
  WebhookIcon,
  GitBranch,
  RotateCcw,
  ShieldAlert,
  Rocket,
} from 'lucide-react'

type StatusFilter = 'all' | 'failed' | 'active' | 'healthy' | 'rolled_back'
const PAGE_SIZE = 20

const triggerMeta: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  manual: { icon: UserIcon, label: 'Manual' },
  webhook: { icon: WebhookIcon, label: 'Webhook' },
  promotion: { icon: GitBranch, label: 'Promotion' },
  rollback: { icon: RotateCcw, label: 'Rollback' },
  auto_rollback: { icon: ShieldAlert, label: 'Auto-rollback' },
}

function shortImage(image: string | null): string {
  if (!image) return '—'
  const parts = image.split('/')
  return parts[parts.length - 1]
}

function duration(startedAt: Date, completedAt: Date | null): string {
  if (!completedAt) return '—'
  const diff = completedAt.getTime() - startedAt.getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSecs = seconds % 60
  return `${minutes}m ${remainingSecs}s`
}

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
}

export function DeploymentFilters({ items, projects, environments }: DeploymentFiltersProps) {
  const router = useRouter()
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
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search deployments…" aria-label="Search deployments" className="h-10 sm:h-8 sm:w-[190px]" />
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger aria-label="Filter by project" className="h-10 w-full sm:h-8 sm:w-[150px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => <SelectItem key={project} value={project}>{project}</SelectItem>)}
                </SelectContent>
              </Select>
              {showEnvironment ? <Select value={envFilter} onValueChange={setEnvFilter}>
                <SelectTrigger aria-label="Filter by environment" className="h-10 w-full sm:h-8 sm:w-[160px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All environments</SelectItem>
                  {environments.map((environment) => <SelectItem key={environment} value={environment}>{environment}</SelectItem>)}
                </SelectContent>
              </Select> : null}
            </div>
          }
        />
        <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2" role="group" aria-label="Filter by deployment status">
          {([['all', 'All'], ['failed', 'Failed'], ['active', 'In progress'], ['healthy', 'Healthy'], ['rolled_back', 'Rolled back']] as const).map(([value, label]) => (
            <Button key={value} type="button" size="sm" variant={status === value ? 'default' : 'ghost'} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1) }}>{label}</Button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Rocket className="h-4 w-4" />}
            title="No deployments"
            body="No deployments match the current filters."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                {showEnvironment ? <TableHead>Environment</TableHead> : null}
                <TableHead>Image</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const meta = triggerMeta[row.deployment.triggerType] ?? triggerMeta.manual
                const TriggerIcon = meta.icon
                return (
                  <TableRow
                    key={row.deployment.id}
                    tabIndex={0}
                    role="link"
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-300"
                    onClick={() => router.push(`/projects/${row.projectSlug}/deployments/${row.deployment.id}`)}
                    onKeyDown={(event) => { if (event.key === 'Enter') router.push(`/projects/${row.projectSlug}/deployments/${row.deployment.id}`) }}
                    aria-label={`View diagnostics for ${row.serviceName} deployment`}
                  >
                    <TableCell>
                      <span className="font-medium text-ink">{row.serviceName}</span>
                      <p className="mt-0.5 text-2xs text-ink-muted">{row.projectName}</p>
                    </TableCell>
                    {showEnvironment ? <TableCell>
                      <span className="text-ink-muted">
                        {row.environmentName}
                      </span>
                    </TableCell> : null}
                    <TableCell>
                      <Mono>{shortImage(row.deployment.imageAfter)}</Mono>
                      {row.deployment.imageBefore && row.deployment.imageBefore !== row.deployment.imageAfter && (
                        <p className="mt-0.5 text-2xs text-ink-muted">
                          from <Mono className="text-2xs text-ink-muted">{shortImage(row.deployment.imageBefore)}</Mono>
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <TriggerIcon className="h-3.5 w-3.5 text-ink-faint" />
                        <span className="min-w-0">
                          <span className="block text-sm text-ink-soft">{meta.label}</span>
                          <span className="block truncate text-2xs text-ink-muted">{row.userName ?? 'System'}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusDot status={row.deployment.status} />
                    </TableCell>
                    <TableCell className="nums text-right">
                      {duration(row.deployment.startedAt, row.deployment.completedAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-ink-muted">
                      <Time value={row.deployment.createdAt} mode="auto" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {filtered.length > PAGE_SIZE ? <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-muted">
          <span>Page {currentPage} of {pageCount}</span>
          <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="ghost" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
        </div> : null}
      </Panel>
    </div>
  )
}
