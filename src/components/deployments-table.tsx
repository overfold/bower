'use client'

import Link from 'next/link'
import { ChevronRight, GitBranch, RotateCcw, ShieldAlert, UserIcon, WebhookIcon } from 'lucide-react'
import { DeploymentStatus, Mono } from '@/components/status'
import { Time } from '@/components/time'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { deploymentImageTag, formatDeploymentDuration, triggerActor } from '@/lib/format'
export { shortDeploymentImage, formatDeploymentDuration } from '@/lib/format'

export type DeploymentsTablePreset = 'organization' | 'project' | 'home' | 'compact' | 'service-compact' | 'service-history'

export interface DeploymentsTableRow {
  deployment: {
    id: string
    status: string
    triggerType: string
    imageAfter: string
    imageBefore?: string | null
    createdAt: Date
    startedAt?: Date
    completedAt?: Date | null
  }
  serviceName: string
  serviceSlug: string
  projectName: string
  projectSlug: string
  userName?: string | null
  /** The Trellis revision the release was accepted as; null when Trellis never accepted it. */
  revision?: string | number | null
  /** The Trellis job version. Redeploys of an unchanged spec share a revision but not a version. */
  version?: string | number | null
  /** The failure event's message, shown under a Failed or Rolled back status. */
  failureMessage?: string | null
  /** The service's live health, when it differs from what the release outcome suggests. */
  serviceHealth?: string | null
  rollbackAction?: React.ReactNode
}

const triggers: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  manual: { icon: UserIcon, label: 'Manual' }, webhook: { icon: WebhookIcon, label: 'Webhook' },
  promotion: { icon: GitBranch, label: 'Promotion' }, rollback: { icon: RotateCcw, label: 'Rollback' },
  auto_rollback: { icon: ShieldAlert, label: 'Auto-rollback' },
}

export function DeploymentsTable({ rows, preset }: { rows: DeploymentsTableRow[]; preset: DeploymentsTablePreset }) {
  const history = preset === 'service-history'
  const compact = ['home', 'compact', 'service-compact'].includes(preset)
  const showService = !history && preset !== 'service-compact'
  return <Table minWidth={compact ? undefined : 'md'} className={compact ? 'table-fixed [&_th]:px-3 [&_td]:px-3' : undefined}>
    <TableHeader><TableRow>
      {history ? <TableHead>Rev</TableHead> : showService ? <TableHead className={compact ? 'w-[29%]' : undefined}>Service</TableHead> : null}
      <TableHead>Image</TableHead><TableHead className={compact ? 'w-32' : undefined}>Status</TableHead>{!compact || history ? <TableHead>Trigger</TableHead> : null}
      {!compact || history ? <TableHead className="text-right">Duration</TableHead> : null}<TableHead className={compact ? 'w-24 text-right' : 'text-right'}>Time</TableHead>
      {history ? <TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead> : null}
      <TableHead className="w-8"><span className="sr-only">Open</span></TableHead>
    </TableRow></TableHeader>
    <TableBody>{rows.map((row) => {
      const href = `/projects/${row.projectSlug}/deployments/${row.deployment.id}`
      const trigger = triggers[row.deployment.triggerType] ?? triggers.manual
      const Trigger = trigger.icon
      const navigate = () => window.location.assign(href)
      return <TableRow key={row.deployment.id} interactive tabIndex={0} role="link" aria-label={`View ${row.serviceName} deployment`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500" onClick={navigate} onKeyDown={(event) => { if (event.key === 'Enter') navigate() }}>
        {history ? row.revision != null && row.revision !== '' ? <TableCell title={`Trellis revision ${row.revision}${row.version != null ? `, job version ${row.version}` : ''}`}><Mono>{row.revision}</Mono>{row.version != null ? <span className="block font-mono text-2xs text-ink-muted">v{row.version}</span> : null}</TableCell> : <TableCell className="text-ink-muted" title="Trellis never accepted this release, so it has no revision.">—</TableCell> : showService ? <TableCell><Link href={href} onClick={(event) => event.stopPropagation()} className="relative z-10 block truncate font-medium text-link" title={row.serviceName}>{row.serviceName}</Link>{preset === 'organization' ? <p className="mt-0.5 text-2xs text-ink-muted">{row.projectName}</p> : null}</TableCell> : null}
        <TableCell><span className="block truncate font-mono text-xs" title={row.deployment.imageAfter}>{!compact && row.deployment.imageBefore && row.deployment.imageBefore !== row.deployment.imageAfter ? <><span className="text-ink-muted">{deploymentImageTag(row.deployment.imageBefore)} → </span></> : null}{deploymentImageTag(row.deployment.imageAfter)}</span><span className="block truncate font-mono text-2xs text-ink-muted">{row.deployment.imageAfter.replace(/(@[^/]+|:[^/:]+)$/, '')}</span></TableCell>
        <TableCell><DeploymentStatus status={row.deployment.status} />{row.failureMessage && ['failed', 'rolled_back'].includes(row.deployment.status) ? <p className="mt-1 line-clamp-2 max-w-64 whitespace-normal text-2xs text-ink-muted" title={row.failureMessage}>{row.failureMessage}</p> : null}{row.deployment.status === 'healthy' && row.serviceHealth && ['degraded', 'down'].includes(row.serviceHealth) ? <p className="mt-1 text-2xs text-danger-500">Service now failing</p> : null}</TableCell>
        {!compact || history ? <TableCell><span className="flex items-center gap-1.5"><Trigger className="size-3.5 text-ink-faint" /><span><span className="block text-sm">{trigger.label}</span><span className="block text-2xs text-ink-muted">{triggerActor(row.deployment.triggerType, row.userName)}</span></span></span></TableCell> : null}
        {!compact || history ? <TableCell className="nums text-right">{formatDeploymentDuration(row.deployment.startedAt, row.deployment.completedAt)}</TableCell> : null}<TableCell className="whitespace-nowrap text-right text-ink-muted"><Time value={row.deployment.createdAt} mode={compact ? 'relative' : 'auto'} /></TableCell>
        {history ? <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>{row.rollbackAction}</TableCell> : null}
        <TableCell><ChevronRight className="ml-auto size-4 text-ink-faint" aria-hidden="true" /></TableCell>
      </TableRow>
    })}</TableBody>
  </Table>
}
