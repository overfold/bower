import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { nodeAllocatable, nodeCapacity, observationFreshness, trellisReadError } from '@/lib/trellis-runtime'
import { parseNodeAllocatedResources } from '@/lib/trellis-resource-metrics'
import { TrellisReadError } from '@/components/trellis-read-error'
import { PageHeading, MetaItem } from '@/components/page-heading'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { Chip, Meter, StatusDot } from '@/components/status'
import { DrainToggle } from '../drain-toggle'
import { formatBytes, formatCpu } from '../format'
import type { TrellisNode } from '@/types/trellis'
import { formatTimestamp } from '@/lib/format'

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
  const back = <Link href="/status" className="inline-flex items-center gap-2 text-[13px] text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to cluster</Link>
  if (!node) return <div className="space-y-6">{back}<PageHeading title={nodeId.slice(0, 8)} description="Node" /><Panel><TrellisReadError title="Node unavailable" message={nodeError!} /></Panel></div>

  const capacity = nodeCapacity(node)
  const allocatable = nodeAllocatable(node)
  const heartbeat = observationFreshness(node.last_heartbeat)
  const metrics = observationFreshness(node.metrics_at)

  return (
    <div className="space-y-6">
      {back}
      <PageHeading title={node.id.slice(0, 8)} description="Node" meta={<MetaItem label="Status" value={<StatusDot status={node.status} />} />} actions={ctx.role === 'owner' ? <DrainToggle nodeId={node.id} drain={node.status === 'draining'} /> : undefined} />
      <Panel>
        <PanelHeader title="Node details" />
        <dl className="grid gap-x-8 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <KeyValue label="IP" mono>{node.host}</KeyValue>
          <KeyValue label="Port">{node.port}</KeyValue>
          <KeyValue label="Version" mono>{node.version || '—'}</KeyValue>
          <KeyValue label="OS">{node.os || '—'} / {node.arch || '—'}</KeyValue>
          <KeyValue label="Control-plane membership">{node.control_plane || 'Not reported'}</KeyValue>
          <KeyValue label="Last heartbeat">{formatTimestamp(node.last_heartbeat)}</KeyValue>
          <KeyValue label="Heartbeat freshness"><Chip tone={heartbeat === 'fresh' ? 'brand' : heartbeat === 'stale' ? 'danger' : 'neutral'}>{heartbeat}</Chip></KeyValue>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader title="Capacity" />
        {metricsError ? <TrellisReadError title="Allocated resources unavailable" message={metricsError} /> : (
          <div className="grid gap-5 p-4 sm:grid-cols-2">
            <div><p className="text-[13px] text-ink-soft">CPU allocated · {formatCpu(allocated.cpu)} / {formatCpu(allocatable.cpu)}</p><div className="mt-2"><Meter value={allocatable.cpu > 0 ? Math.round(allocated.cpu / allocatable.cpu * 100) : 0} label="Node CPU allocated" /></div></div>
            <div><p className="text-[13px] text-ink-soft">Memory allocated · {formatBytes(allocated.memory)} / {formatBytes(allocatable.memory)}</p><div className="mt-2"><Meter value={allocatable.memory > 0 ? Math.round(allocated.memory / allocatable.memory * 100) : 0} label="Node memory allocated" /></div></div>
          </div>
        )}
        <dl className="grid gap-x-8 border-t border-line px-4 py-2 sm:grid-cols-2">
          <KeyValue label="Physical CPU">{formatCpu(capacity.cpu)}</KeyValue>
          <KeyValue label="Physical memory">{formatBytes(capacity.memory)}</KeyValue>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader title="Live observation" hint={metrics === 'unknown' ? 'No observation reported' : `${metrics === 'fresh' ? 'Fresh' : 'Stale'} · ${formatTimestamp(node.metrics_at)}`} />
        <dl className="grid gap-x-8 p-4 sm:grid-cols-3">
          <KeyValue label="CPU usage">{node.cpu_usage == null ? 'Unknown' : `${Math.round(node.cpu_usage * 100)}%`}</KeyValue>
          <KeyValue label="Memory used">{node.memory_used == null ? 'Unknown' : formatBytes(node.memory_used)}</KeyValue>
          <KeyValue label="Memory available">{node.memory_available == null ? 'Unknown' : formatBytes(node.memory_available)}</KeyValue>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader title="Capabilities" />
        <div className="flex flex-wrap gap-2 p-4">{node.capabilities?.length ? node.capabilities.map((capability) => <Chip key={capability}>{capability}</Chip>) : <span className="text-[13px] text-ink-muted">None reported</span>}</div>
      </Panel>
    </div>
  )
}
