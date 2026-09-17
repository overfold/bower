'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { StatusDot, Chip, Mono } from '@/components/status'
import { EmptyState } from '@/components/ui/empty-state'
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

type StatusFilter = 'all' | 'active' | 'failed'

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

function relTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
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
  const [status] = useState<StatusFilter>('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [envFilter, setEnvFilter] = useState('all')

  const filtered = useMemo(() => {
    const activeStatuses = ['pending', 'planning', 'deploying']
    const failedStatuses = ['failed', 'rolled_back']
    return items.filter((d) => {
      if (projectFilter !== 'all' && d.projectName !== projectFilter) return false
      if (envFilter !== 'all' && d.environmentName !== envFilter) return false
      if (status === 'active' && !activeStatuses.includes(d.deployment.status)) return false
      if (status === 'failed' && !failedStatuses.includes(d.deployment.status)) return false
      return true
    })
  }, [items, status, projectFilter, envFilter])

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          className="h-auto flex-col items-stretch py-3 sm:min-h-[52px] sm:flex-row sm:items-center sm:py-0"
          title={`${filtered.length} deployment${filtered.length === 1 ? '' : 's'}`}
          action={
            <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
              <select
                aria-label="Filter by project"
                className="h-10 w-full appearance-none rounded-lg sm:h-8 sm:w-[150px] border border-line bg-surface px-2.5 pr-8 text-[12.5px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="all">All projects</option>
                {projects.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                aria-label="Filter by environment"
                className="h-10 w-full appearance-none rounded-lg sm:h-8 sm:w-[160px] border border-line bg-surface px-2.5 pr-8 text-[12.5px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value)}
              >
                <option value="all">All environments</option>
                {environments.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
          }
        />
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
                <TableHead>Environment</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const meta = triggerMeta[row.deployment.triggerType] ?? triggerMeta.manual
                const TriggerIcon = meta.icon
                return (
                  <TableRow key={row.deployment.id}>
                    <TableCell>
                      <Link
                        href={`/projects/${row.projectSlug}/services/${row.serviceSlug}`}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {row.serviceName}
                      </Link>
                      <p className="mt-0.5 text-2xs text-ink-muted">{row.projectName}</p>
                    </TableCell>
                    <TableCell>
                      <Chip tone={row.environmentName === 'production' ? 'info' : 'neutral'}>
                        {row.environmentName}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Mono>{shortImage(row.deployment.imageAfter)}</Mono>
                      {row.deployment.imageBefore && row.deployment.imageBefore !== row.deployment.imageAfter && (
                        <p className="mt-0.5 font-mono text-2xs text-ink-faint">
                          from {shortImage(row.deployment.imageBefore)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <TriggerIcon className="h-3.5 w-3.5 text-ink-faint" />
                        <span className="min-w-0">
                          <span className="block text-[12.5px] text-ink-soft">{meta.label}</span>
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
                      {relTime(row.deployment.createdAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
