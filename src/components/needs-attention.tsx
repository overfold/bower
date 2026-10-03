import Link from 'next/link'
import { type AttentionRow } from '@/lib/needs-attention'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { DeploymentStatus, StatusDot } from '@/components/status'
import { Time } from '@/components/time'
import { Button } from '@/components/ui/button'

export function NeedsAttention({ rows }: { rows: AttentionRow[] }) {
  if (!rows.length) return null
  return <Panel><PanelHeader title="Needs attention" /><Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>What</TableHead><TableHead>Cause</TableHead><TableHead>Time</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>
    {rows.map((row) => <TableRow key={row.id}><TableCell>{row.status === 'failed' ? <DeploymentStatus status="failed" /> : <StatusDot status={row.status} />}</TableCell><TableCell><span className="font-medium text-ink">{row.serviceName}</span>{row.specificId ? <p className="mt-0.5 font-mono text-xs text-ink-muted">{row.specificId}</p> : null}</TableCell><TableCell>{row.cause}</TableCell><TableCell>{row.since ? <Time value={row.since} /> : '—'}</TableCell><TableCell className="text-right"><Button asChild size="sm"><Link href={row.href}>{row.action}</Link></Button></TableCell></TableRow>)}
  </TableBody></Table></Panel>
}
