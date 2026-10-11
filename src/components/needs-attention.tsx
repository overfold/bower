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
  return <Panel><PanelHeader title="Needs attention" hint="Services that need attention right now, with the likely cause." /><Table><TableHeader><TableRow><TableHead>What</TableHead><TableHead>Status</TableHead><TableHead>Cause</TableHead><TableHead>Since</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>
    {rows.map((row) => <TableRow key={row.id}>
      <TableCell><span className="font-medium text-ink">{row.serviceName}</span>{row.specificId ? <p className="mt-0.5 font-mono text-xs text-ink-muted">{row.specificId}</p> : null}</TableCell>
      <TableCell>{deploymentStatuses.includes(row.status) ? <DeploymentStatus status={row.status} /> : <StatusDot status={row.status} />}</TableCell>
      <TableCell>{row.cause}</TableCell>
      <TableCell className="whitespace-nowrap">{row.since ? <Time value={row.since} /> : '—'}</TableCell>
      <TableCell className="text-right"><Button asChild size="sm"><Link href={row.href}>{row.action}</Link></Button></TableCell>
    </TableRow>)}
  </TableBody></Table></Panel>
}
