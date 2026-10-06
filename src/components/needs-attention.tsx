import Link from 'next/link'
import { type AttentionRow } from '@/lib/needs-attention'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { DeploymentStatus, StatusDot } from '@/components/status'
import { Time } from '@/components/time'
import { Button } from '@/components/ui/button'

const deploymentStatuses = ['failed', 'rolled_back']

export function NeedsAttention({ rows }: { rows: AttentionRow[] }) {
  if (!rows.length) return null
  return <Panel><PanelHeader title="Needs attention" /><Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>What</TableHead><TableHead>Cause</TableHead><TableHead>Failing since</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>
    {rows.map((row) => <TableRow key={row.id}>
      <TableCell>{deploymentStatuses.includes(row.status) ? <DeploymentStatus status={row.status} /> : <StatusDot status={row.status} />}</TableCell>
      <TableCell><span className="font-medium text-ink">{row.serviceName}</span>{row.specificId ? <p className="mt-0.5 font-mono text-xs text-ink-muted">{row.specificId}</p> : null}</TableCell>
      <TableCell><p>{row.cause}</p>{row.details?.map((detail) => <p key={detail} className="mt-0.5 text-xs text-ink-muted">{detail}</p>)}</TableCell>
      <TableCell className="whitespace-nowrap">{row.since ? <Time value={row.since} /> : '—'}{row.lastFailureAt ? <p className="mt-0.5 text-xs text-ink-muted">Last failure <Time value={row.lastFailureAt} /></p> : null}</TableCell>
      <TableCell className="text-right"><div className="flex justify-end gap-2">{row.secondary ? <Button asChild size="sm" variant="ghost"><Link href={row.secondary.href}>{row.secondary.action}</Link></Button> : null}<Button asChild size="sm"><Link href={row.href}>{row.action}</Link></Button></div></TableCell>
    </TableRow>)}
  </TableBody></Table></Panel>
}
