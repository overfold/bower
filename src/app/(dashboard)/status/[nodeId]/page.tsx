import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { nodeAllocatable, nodeCapacity, observationFreshness, trellisReadError } from '@/lib/trellis-runtime'
import { parseNodeAllocatedResources } from '@/lib/trellis-resource-metrics'
import { TrellisReadError } from '@/components/trellis-read-error'
import { PageHeading, MetaItem } from '@/components/page-heading'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { Chip, StatusDot } from '@/components/status'
import { DrainToggle } from '../drain-toggle'
import { formatCpu, formatMemory } from '@/lib/format'
import type { TrellisNode } from '@/types/trellis'
import { formatTimestamp } from '@/lib/format'
import { ResourceId } from '@/components/resource-id'
import { label } from '@/lib/labels'

export default async function NodePage({ params }: { params: Promise<{ nodeId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const ctx = await getUserOrganization(user.id)
  if (!ctx) redirect('/login')
  const { nodeId } = await params
  let node: TrellisNode | undefined
  let nodeError: string | null = null
  let metricsError: string | null = null
  let allocated = { cpu: 0, memory: 0 }
  try {
    const client = await getTrellisClient(ctx.org.id)
    const [nodes, metrics] = await Promise.allSettled([client.listNodes(), client.getMetrics()])
    if (nodes.status === 'fulfilled') node = nodes.value.find((item) => item.id === nodeId)
    else nodeError = trellisReadError(nodes.reason)
    if (metrics.status === 'fulfilled') allocated = parseNodeAllocatedResources(metrics.value).get(nodeId) ?? allocated
    else metricsError = trellisReadError(metrics.reason)
  } catch (error) {
    nodeError = trellisReadError(error)
  }
  if (!node && !nodeError) notFound()
  if (!node) return <div className="space-y-6"><PageHeading title="Node unavailable" meta={<ResourceId value={nodeId} copy />} /><Panel><TrellisReadError title="Node unavailable" message={nodeError!} /></Panel></div>

  const capacity = nodeCapacity(node)
  const allocatable = nodeAllocatable(node)
  const heartbeat = observationFreshness(node.last_heartbeat)
  const metrics = observationFreshness(node.metrics_at)
  const cpuUsed = node.cpu_usage == null ? 0 : node.cpu_usage * allocatable.cpu
  const cpuUsedPct = allocatable.cpu > 0 ? Math.min(100, cpuUsed / allocatable.cpu * 100) : 0
  const cpuAllocatedPct = allocatable.cpu > 0 ? Math.min(100, allocated.cpu / allocatable.cpu * 100) : 0
  const memoryUsed = node.memory_used ?? 0
  const memoryUsedPct = allocatable.memory > 0 ? Math.min(100, memoryUsed / allocatable.memory * 100) : 0
  const memoryAllocatedPct = allocatable.memory > 0 ? Math.min(100, allocated.memory / allocatable.memory * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeading title={`Node ${node.id}`} meta={<><ResourceId value={node.id} copy /><MetaItem label="Status" value={<StatusDot status={node.status === 'healthy' ? 'ready' : node.status} />} /></>} actions={ctx.role === 'owner' ? <DrainToggle nodeId={node.id} drain={node.status === 'draining'} /> : undefined} />
      <Panel>
        <PanelHeader title="Node details" />
        <dl className="grid gap-x-8 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <KeyValue label="IP" mono>{node.host}</KeyValue>
          <KeyValue label="Port" mono>{node.port}</KeyValue>
          <KeyValue label="Version">{node.version || '—'}</KeyValue>
          <KeyValue label="OS">{node.os || '—'} / {node.arch || '—'}</KeyValue>
          <KeyValue label="Control-plane membership">{node.control_plane ? label(node.control_plane) : 'Not reported'}</KeyValue>
          <KeyValue label="Last heartbeat">{formatTimestamp(node.last_heartbeat)}</KeyValue>
          <KeyValue label="Heartbeat freshness"><Chip tone={heartbeat === 'fresh' ? 'success' : heartbeat === 'stale' ? 'danger' : 'neutral'}>{label(heartbeat)}</Chip></KeyValue>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader title="Capacity" />
        {metricsError ? <TrellisReadError title="Allocated resources unavailable" message={metricsError} /> : (
          <div className="grid gap-5 p-4 sm:grid-cols-2">
            <ResourceBar label="CPU" used={formatCpu(cpuUsed)} allocated={formatCpu(allocated.cpu)} total={formatCpu(allocatable.cpu)} usedPct={cpuUsedPct} allocatedPct={cpuAllocatedPct} />
            <ResourceBar label="Memory" used={formatMemory(memoryUsed)} allocated={formatMemory(allocated.memory)} total={formatMemory(allocatable.memory)} usedPct={memoryUsedPct} allocatedPct={memoryAllocatedPct} />
          </div>
        )}
        <dl className="grid gap-x-8 border-t border-line px-4 py-2 sm:grid-cols-2">
          <KeyValue label="Physical CPU">{formatCpu(capacity.cpu)}</KeyValue>
          <KeyValue label="Physical memory">{formatMemory(capacity.memory)}</KeyValue>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader title="Live observation" hint={metrics === 'unknown' ? 'No observation reported' : `${metrics === 'fresh' ? 'Fresh' : 'Stale'} · ${formatTimestamp(node.metrics_at)}`} />
        <dl className="grid gap-x-8 p-4 sm:grid-cols-3">
          <KeyValue label="CPU usage">{node.cpu_usage == null ? 'Unknown' : `${Math.round(node.cpu_usage * 100)}%`}</KeyValue>
          <KeyValue label="Memory used">{node.memory_used == null ? 'Unknown' : formatMemory(node.memory_used)}</KeyValue>
          <KeyValue label="Memory available">{node.memory_available == null ? 'Unknown' : formatMemory(node.memory_available)}</KeyValue>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader title="Capabilities" />
        <div className="p-4 text-sm text-ink-muted">{node.capabilities?.join(', ') || 'None reported'}</div>
      </Panel>
    </div>
  )
}

function ResourceBar({ label, used, allocated, total, usedPct, allocatedPct }: { label: string; used: string; allocated: string; total: string; usedPct: number; allocatedPct: number }) {
  const title = `${label}: ${used} used (${Math.round(usedPct)}%), ${allocated} allocated (${Math.round(allocatedPct)}%), ${total} total`
  return <div><p className="text-sm text-ink-soft">{label} · {total}</p><div className="relative mt-2 h-3 overflow-hidden rounded-md bg-line" title={title} role="img" aria-label={title}><span className="absolute bottom-0 left-0 h-1/2 bg-info-500" style={{ width: `${allocatedPct}%` }} /><span className="absolute left-0 top-0 h-1/2 bg-brand-500" style={{ width: `${usedPct}%` }} /></div><div className="mt-2 flex gap-4 text-xs text-ink-muted"><span><i className="mr-1 inline-block h-2 w-2 bg-brand-500" />Used {used}</span><span><i className="mr-1 inline-block h-2 w-2 bg-info-500" />Allocated {allocated}</span></div></div>
}
