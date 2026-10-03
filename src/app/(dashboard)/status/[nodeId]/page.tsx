import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOperationalTargetsForOrg, getUserOrganization } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { nodeAllocatable, nodeCapacity, observationFreshness, trellisReadError } from '@/lib/trellis-runtime'
import { parseNodeAllocatedResources } from '@/lib/trellis-resource-metrics'
import { TrellisReadError } from '@/components/trellis-read-error'
import { PageHeading } from '@/components/page-heading'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { AllocationStatus, Chip, StatusDot } from '@/components/status'
import { DrainToggle } from '../drain-toggle'
import { formatCpu, formatMemory } from '@/lib/format'
import type { TrellisAllocation, TrellisNode } from '@/types/trellis'
import { ResourceId } from '@/components/resource-id'
import { label } from '@/lib/labels'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ChevronRight, Info } from 'lucide-react'
import { ClickableTableRow } from '@/components/clickable-table-row'
import { Time } from '@/components/time'

export default async function NodePage({ params }: { params: Promise<{ nodeId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const ctx = await getUserOrganization(user.id)
  if (!ctx) redirect('/login')
  const { nodeId } = await params
  let node: TrellisNode | undefined
  let allocations: TrellisAllocation[] = []
  let nodeError: string | null = null
  let metricsError: string | null = null
  let allocationsError: string | null = null
  let allocated = { cpu: 0, memory: 0 }
  try {
    const client = await getTrellisClient(ctx.org.id)
    const [nodes, metrics, listedAllocations] = await Promise.allSettled([client.listNodes(), client.getMetrics(), client.listAllocations()])
    if (nodes.status === 'fulfilled') node = nodes.value.find((item) => item.id === nodeId)
    else nodeError = trellisReadError(nodes.reason)
    if (metrics.status === 'fulfilled') allocated = parseNodeAllocatedResources(metrics.value).get(nodeId) ?? allocated
    else metricsError = trellisReadError(metrics.reason)
    if (listedAllocations.status === 'fulfilled') allocations = listedAllocations.value.filter((allocation) => allocation.node_id === nodeId)
    else allocationsError = trellisReadError(listedAllocations.reason)
  } catch (error) {
    nodeError = trellisReadError(error)
  }
  if (!node && !nodeError) notFound()
  if (!node) return <div className="space-y-6"><PageHeading title="Node unavailable" meta={<ResourceId value={nodeId} copy />} /><Panel><TrellisReadError title="Node unavailable" message={nodeError!} /></Panel></div>

  const capacity = nodeCapacity(node)
  const allocatable = nodeAllocatable(node)
  const heartbeat = observationFreshness(node.last_heartbeat)
  const metrics = observationFreshness(node.metrics_at)
  const cpuUsed = node.cpu_usage == null ? null : node.cpu_usage * allocatable.cpu
  const cpuUsedPct = cpuUsed != null && allocatable.cpu > 0 ? Math.min(100, cpuUsed / allocatable.cpu * 100) : null
  const cpuAllocatedPct = allocatable.cpu > 0 ? allocated.cpu / allocatable.cpu * 100 : 0
  const memoryUsed = node.memory_used ?? null
  const memoryUsedPct = memoryUsed != null && allocatable.memory > 0 ? Math.min(100, memoryUsed / allocatable.memory * 100) : null
  const memoryAllocatedPct = allocatable.memory > 0 ? allocated.memory / allocatable.memory * 100 : 0
  const targets = await getOperationalTargetsForOrg(ctx.org.id)
  const activeAllocations = allocations.filter((allocation) => !['stopped', 'failed', 'lost'].includes(allocation.phase))
  const nodeDrained = allocationsError === null && node.status === 'draining' && activeAllocations.length === 0

  return (
    <div className="space-y-6">
      <PageHeading title={<span className="flex flex-wrap items-center gap-3">{node.id}<StatusDot status={nodeDrained ? 'drained' : node.status === 'healthy' ? 'ready' : node.status} /></span>} description={nodeDrained ? 'No allocations left. Ready for maintenance.' : undefined} actions={ctx.role === 'owner' ? <DrainToggle nodeId={node.id} drain={node.status === 'draining'} allocationCount={activeAllocations.length} /> : undefined} />
      <Panel>
        <PanelHeader title="Node details" />
        <dl className="grid gap-x-8 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <KeyValue label="IP" mono>{node.host}</KeyValue>
          <KeyValue label="Port" mono>{node.port}</KeyValue>
          <KeyValue label="Version">{node.version || '—'}</KeyValue>
          <KeyValue label="OS">{node.os || '—'} / {node.arch || '—'}</KeyValue>
          <KeyValue label={<PlainNodeLabel label="Cluster role" trellis="Control-plane membership" />}>{node.control_plane ? label(node.control_plane) : 'Not reported'}</KeyValue>
          <KeyValue label="Last heartbeat"><Time value={node.last_heartbeat} mode="absolute" /></KeyValue>
          <KeyValue label="Heartbeat freshness"><Chip tone={heartbeat === 'fresh' ? 'success' : heartbeat === 'stale' ? 'danger' : 'neutral'}>{label(heartbeat)}</Chip></KeyValue>
          <KeyValue label="Capabilities">{node.capabilities?.join(', ') || 'None reported'}</KeyValue>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader title="Capacity" />
        {metricsError ? <TrellisReadError title="Allocated resources unavailable" message={metricsError} /> : null}
        <div className="grid gap-5 p-4 sm:grid-cols-2">
          <ResourceBar label="CPU" used={cpuUsed == null ? null : formatCpu(cpuUsed)} allocated={metricsError ? null : formatCpu(allocated.cpu)} total={formatCpu(allocatable.cpu)} usedPct={cpuUsedPct} allocatedPct={metricsError ? null : cpuAllocatedPct} />
          <ResourceBar label="Memory" used={memoryUsed == null ? null : formatMemory(memoryUsed)} allocated={metricsError ? null : formatMemory(allocated.memory)} total={formatMemory(allocatable.memory)} usedPct={memoryUsedPct} allocatedPct={metricsError ? null : memoryAllocatedPct} />
        </div>
        <dl className="grid gap-x-8 border-t border-line px-4 py-2 sm:grid-cols-2">
          <KeyValue label="Physical CPU">{formatCpu(capacity.cpu)}</KeyValue>
          <KeyValue label="Physical memory">{formatMemory(capacity.memory)}</KeyValue>
          <KeyValue label="Observation">{metrics === 'unknown' ? 'No observation reported' : <>{label(metrics)} · <Time value={node.metrics_at} mode="absolute" /></>}</KeyValue>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader title="Allocations on this node" hint={`${allocations.length} allocation${allocations.length === 1 ? '' : 's'}`} />
        {allocationsError ? <TrellisReadError title="Allocations unavailable" message={allocationsError} /> : allocations.length ? <Table><TableHeader><TableRow><TableHead>Allocation</TableHead><TableHead>Service</TableHead><TableHead>Status</TableHead><TableHead>Time</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader><TableBody>{allocations.map((allocation) => {
          const target = targets.find((item) => item.namespace === allocation.namespace && (item.job === allocation.job || item.serviceSlug === allocation.labels?.['bower/service']))
          const href = target ? `/projects/${target.projectSlug}/services/${target.serviceSlug}/allocations/${allocation.id}` : null
          const cells = <><TableCell>{href ? <Link className="relative z-10 text-link hover:underline" href={href}><ResourceId value={allocation.id} /></Link> : <ResourceId value={allocation.id} />}</TableCell><TableCell>{target?.serviceName ?? allocation.job}</TableCell><TableCell><AllocationStatus phase={allocation.phase} health={allocation.health} /></TableCell><TableCell><Time value={allocation.created_at} mode="absolute" /></TableCell><TableCell>{href ? <ChevronRight className="ml-auto size-4 text-ink-faint" /> : null}</TableCell></>
          return href ? <ClickableTableRow key={allocation.id} href={href} label={`View allocation ${allocation.id}`}>{cells}</ClickableTableRow> : <TableRow key={allocation.id}>{cells}</TableRow>
        })}</TableBody></Table> : <p className="border-t border-line px-4 py-3 text-sm text-ink-muted">No allocations are currently placed on this node.</p>}
      </Panel>
    </div>
  )
}

function ResourceBar({ label, used, allocated, total, usedPct, allocatedPct }: { label: string; used: string | null; allocated: string | null; total: string; usedPct: number | null; allocatedPct: number | null }) {
  const title = `${label}: ${used ?? 'usage unavailable'} used, ${allocated ?? 'allocation unavailable'} allocated, ${total} total`
  const overallocated = allocatedPct != null && allocatedPct > 100
  return <div><p className="text-sm text-ink-soft">{label} · {total}</p><div className="relative mt-2 h-3 overflow-hidden rounded-md bg-line" title={title} role="img" aria-label={title}>{allocatedPct != null ? <span className={`absolute inset-y-0 left-0 rounded-md ${overallocated ? 'bg-warn-500' : 'bg-brand-200'}`} style={{ width: `${Math.min(100, allocatedPct)}%` }} /> : null}{usedPct != null ? <span className="absolute inset-y-0 left-0 rounded-md bg-brand-500" style={{ width: `${Math.min(100, usedPct)}%` }} /> : null}</div><div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-muted"><span><i className="mr-1 inline-block h-2 w-2 bg-brand-500" />Used {used ?? 'Unavailable'}</span><span><i className={`mr-1 inline-block h-2 w-2 ${overallocated ? 'bg-warn-500' : 'bg-brand-200'}`} />Allocated {allocated ?? 'Unavailable'}{overallocated ? ' · Overallocated' : ''}</span></div></div>
}

function PlainNodeLabel({ label: text, trellis }: { label: string; trellis: string }) {
  return <span className="inline-flex items-center gap-1">{text}<TooltipProvider><Tooltip><TooltipTrigger aria-label={`${text} terminology`}><Info className="size-3 text-ink-faint" /></TooltipTrigger><TooltipContent>Trellis: {trellis}</TooltipContent></Tooltip></TooltipProvider></span>
}
