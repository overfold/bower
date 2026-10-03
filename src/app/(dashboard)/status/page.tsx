import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getManagedProxiesForOrg, getOperationalTargetsForOrg, getRouteCountsByEnvironment, getUserOrganization } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import {
  managedProxyObservation,
  nodeAllocatable,
  pendingReasonCounts,
  trellisReadError,
} from '@/lib/trellis-runtime'
import { TrellisReadError } from '@/components/trellis-read-error'
import { NodeLink } from '@/components/node-link'
import { parseNodeAllocatedResources } from '@/lib/trellis-resource-metrics'
import { PageHeading } from '@/components/page-heading'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Chip, Meter, Mono, StatusDot } from '@/components/status'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronRight } from 'lucide-react'
import { DrainToggle } from './drain-toggle'
import { ResetBackoffButton } from './reset-backoff-button'
import { formatCpu, formatMemory } from '@/lib/format'
import type { TrellisAllocation, TrellisJob, TrellisNode } from '@/types/trellis'
import { formatRelativeTime, formatTimestamp } from '@/lib/format'
import { ResourceId } from '@/components/resource-id'
import { ClickableTableRow } from '@/components/clickable-table-row'

function untilTime(value: string): string {
  const seconds = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.ceil(seconds / 3600)}h`
  return `${Math.ceil(seconds / 86_400)}d`
}

export default async function StatusPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const [proxies, routeCounts, targets] = await Promise.all([
    getManagedProxiesForOrg(orgCtx.org.id),
    getRouteCountsByEnvironment(orgCtx.org.id),
    getOperationalTargetsForOrg(orgCtx.org.id),
  ])
  const namespaces = [...new Set([...targets.map((target) => target.namespace), ...proxies.map((proxy) => proxy.namespace)])]

  let nodes: TrellisNode[] = []
  const allocations: TrellisAllocation[] = []
  const jobs: Array<{ namespace: string; job: TrellisJob }> = []
  let allocatedByNode = new Map<string, { cpu: number; memory: number }>()
  let clusterError: string | null = null
  let metricsError: string | null = null
  let operationsError: string | null = null
  let allocationsAvailable = namespaces.length > 0

  try {
    const client = await getTrellisClient(orgCtx.org.id)
    const [nodeResult, metricsResult, ...namespaceResults] = await Promise.allSettled([
      client.listNodes(),
      client.getMetrics(),
      ...namespaces.flatMap((namespace) => [client.listAllocations({ namespace }), client.listJobs(namespace)]),
    ])
    if (nodeResult.status === 'fulfilled') nodes = nodeResult.value
    else clusterError = trellisReadError(nodeResult.reason)
    if (metricsResult.status === 'fulfilled') allocatedByNode = parseNodeAllocatedResources(metricsResult.value)
    else metricsError = trellisReadError(metricsResult.reason)
    namespaces.forEach((namespace, index) => {
      const allocationResult = namespaceResults[index * 2]
      const jobResult = namespaceResults[index * 2 + 1]
      if (allocationResult?.status === 'fulfilled') allocations.push(...allocationResult.value as TrellisAllocation[])
      else if (allocationResult?.status === 'rejected') {
        allocationsAvailable = false
        operationsError ??= trellisReadError(allocationResult.reason)
      }
      if (jobResult?.status === 'fulfilled') jobs.push(...(jobResult.value as TrellisJob[]).map((job) => ({ namespace, job })))
      else if (jobResult?.status === 'rejected') operationsError ??= trellisReadError(jobResult.reason)
    })
  } catch (error) {
    allocationsAvailable = false
    clusterError = metricsError = operationsError = trellisReadError(error)
  }

  const routeCountMap = new Map(routeCounts.map((row) => [row.environmentId, row.count]))
  const targetFor = (allocation: TrellisAllocation) => targets.find((target) => target.namespace === allocation.namespace && (
    target.serviceSlug === allocation.labels?.['bower/service'] || target.job === allocation.job || (!target.job && target.serviceSlug === allocation.job)
  ))
  const targetForJob = (namespace: string, name: string) => targets.find((target) => target.namespace === namespace && (target.job === name || (!target.job && target.serviceSlug === name)))
  const pending = allocations.filter((allocation) => allocation.phase === 'pending')
  const reasonCounts = pendingReasonCounts(pending)
  const backoffs = jobs.flatMap(({ namespace, job }) => (job.replacement_backoff ?? []).map((backoff) => ({ namespace, job: job.name, backoff })))
  const canResetBackoff = orgCtx.role === 'owner' || orgCtx.role === 'admin'

  const totalAllocatableCpu = nodes.reduce((sum, node) => sum + nodeAllocatable(node).cpu, 0)
  const totalAllocatableMemory = nodes.reduce((sum, node) => sum + nodeAllocatable(node).memory, 0)
  const allocatedCpu = nodes.reduce((sum, node) => sum + (allocatedByNode.get(node.id)?.cpu ?? 0), 0)
  const allocatedMemory = nodes.reduce((sum, node) => sum + (allocatedByNode.get(node.id)?.memory ?? 0), 0)
  const cpuPct = totalAllocatableCpu > 0 ? Math.round(allocatedCpu / totalAllocatableCpu * 100) : 0
  const memoryPct = totalAllocatableMemory > 0 ? Math.round(allocatedMemory / totalAllocatableMemory * 100) : 0

  const observedProxies = proxies.map((row) => ({
    ...row,
    observation: managedProxyObservation(allocations, row.namespace, row.proxy.trellisJobName, row.proxy.configHash),
  }))
  const drainingNodes = nodes.filter((node) => node.status === 'draining' && (!allocationsAvailable || allocations.some((allocation) => allocation.node_id === node.id && !['stopped', 'failed', 'lost'].includes(allocation.phase)))).length

  return (
    <div className="space-y-6">
      <PageHeading title="Status" description="Monitor cluster capacity, placement, restart cooldowns, and managed ingress." />

      <Panel aria-label="Cluster status summary">
        <div className="grid items-center gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_1fr]">
          <div><p className="text-xs text-ink-muted">Connection</p><StatusDot status={clusterError ? 'unhealthy' : 'healthy'} /></div>
          <p className="nums text-sm">{clusterError ? 'Nodes unavailable' : `${nodes.length} nodes · ${drainingNodes} draining`}</p>
          <div><p className="text-xs text-ink-muted">CPU allocated · {formatCpu(allocatedCpu)} / {formatCpu(totalAllocatableCpu)}</p><Meter value={cpuPct} label="Cluster CPU allocated" /></div>
          <div><p className="text-xs text-ink-muted">Memory allocated · {formatMemory(allocatedMemory)} / {formatMemory(totalAllocatableMemory)}</p><Meter value={memoryPct} label="Cluster memory allocated" /></div>
        </div>
        {clusterError ? <TrellisReadError title="Node data unavailable" message={clusterError} /> : metricsError ? <TrellisReadError title="Capacity data unavailable" message={metricsError} /> : null}
      </Panel>

      <Panel>
        {pending.length || operationsError ? <PanelHeader title="Pending allocations" hint={pending.length ? `${pending.length} waiting across ${reasonCounts.length} reason${reasonCounts.length === 1 ? '' : 's'}` : undefined} /> : null}
        {operationsError ? <TrellisReadError title="Allocation diagnostics incomplete" message={operationsError} /> : null}
        {pending.length > 0 ? <>
          <div className="flex flex-wrap gap-2 border-b border-line p-4">{reasonCounts.map(({ reason, count }) => <Chip key={reason} tone="warn"><span className="nums">{count}</span> {reason.replaceAll('_', ' ')}</Chip>)}</div>
          <Table><TableHeader><TableRow><TableHead>Allocation</TableHead><TableHead>Workload</TableHead><TableHead>Reason</TableHead><TableHead>Waiting</TableHead></TableRow></TableHeader><TableBody>
            {pending.map((allocation) => {
              const target = targetFor(allocation)
              const href = target ? `/projects/${target.projectSlug}/services/${target.serviceSlug}/allocations/${allocation.id}` : null
              return <TableRow key={`${allocation.namespace}/${allocation.id}`}>
                <TableCell>{href ? <Link href={href} className="text-link"><ResourceId value={allocation.id} /></Link> : <ResourceId value={allocation.id} />}</TableCell>
                <TableCell><div className="text-ink">{target?.serviceName ?? allocation.job}</div><div className="text-xs text-ink-muted">{target ? `${target.projectName} · ${target.environmentName}` : allocation.namespace}</div></TableCell>
                <TableCell><Chip tone="warn">{(allocation.reason || 'awaiting_placement').replaceAll('_', ' ')}</Chip>{allocation.message ? <p className="mt-1 max-w-md text-xs text-ink-muted">{allocation.message}</p> : null}</TableCell>
                <TableCell className="text-ink-muted">{formatRelativeTime(allocation.created_at)}</TableCell>
              </TableRow>
            })}
          </TableBody></Table>
        </> : !operationsError ? <p className="px-4 py-3 text-sm text-ink-muted">No pending allocations</p> : null}
      </Panel>

      {backoffs.length > 0 ? <Panel>
        <PanelHeader title="Restart pending" hint="After repeated crashes, Bower waits before starting the service again. Fix the cause, then restart." />
        <Table><TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Failures</TableHead><TableHead>Last failure</TableHead><TableHead>Next restart</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>
          {backoffs.map(({ namespace, job, backoff }) => {
            const target = targetForJob(namespace, job)
            return <TableRow key={`${namespace}/${job}/${backoff.group}`}>
              <TableCell>{target ? <Link href={`/projects/${target.projectSlug}/services/${target.serviceSlug}`} className="font-medium text-link">{target.serviceName}</Link> : <Mono>{job}</Mono>}</TableCell>
              <TableCell className="nums">{backoff.failures}</TableCell>
              <TableCell><span className="whitespace-nowrap">{formatRelativeTime(backoff.last_failure_at)}</span><p className="mt-1 max-w-sm text-xs text-ink-muted">{backoff.message || backoff.reason || 'Allocation failed'}</p></TableCell>
              <TableCell><span className="whitespace-nowrap">{formatTimestamp(backoff.next_replacement_at)}</span><p className="mt-1 text-xs text-ink-muted">in {untilTime(backoff.next_replacement_at)}</p></TableCell>
              <TableCell className="text-right">{canResetBackoff ? <ResetBackoffButton namespace={namespace} job={job} group={backoff.group} /> : <span className="text-xs text-ink-muted">Owner/admin required</span>}</TableCell>
            </TableRow>
          })}
        </TableBody></Table>
      </Panel> : null}

      <Panel>
        <PanelHeader title="Nodes" />
        {clusterError ? <TrellisReadError title="Nodes unavailable" message={clusterError} /> : nodes.length === 0 ? <p className="border-t border-line px-4 py-3 text-sm text-ink-muted">No nodes are registered with this cluster.</p> : <Table>
          <TableHeader><TableRow><TableHead>Node</TableHead><TableHead>Status</TableHead><TableHead>Address</TableHead><TableHead>Software</TableHead><TableHead>System</TableHead><TableHead>Resources</TableHead><TableHead>Capabilities</TableHead>{orgCtx.role === 'owner' ? <TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead> : null}<TableHead className="w-8"><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
          <TableBody>{nodes.map((node) => {
            const allocated = allocatedByNode.get(node.id)
            const allocatable = nodeAllocatable(node)
            const allocatedCpuPct = allocatable.cpu > 0 ? Math.round((allocated?.cpu ?? 0) / allocatable.cpu * 100) : 0
            const allocatedMemoryPct = allocatable.memory > 0 ? Math.round((allocated?.memory ?? 0) / allocatable.memory * 100) : 0
            const activeCount = allocations.filter((allocation) => allocation.node_id === node.id && !['stopped', 'failed', 'lost'].includes(allocation.phase)).length
            const drained = allocationsAvailable && node.status === 'draining' && activeCount === 0
            return <ClickableTableRow key={node.id} href={`/status/${encodeURIComponent(node.id)}`} label={`View node ${node.id}`}>
              <TableCell><NodeLink id={node.id} name={node.id} /></TableCell>
              <TableCell><StatusDot status={drained ? 'drained' : node.status === 'healthy' ? 'ready' : node.status} />{drained ? <p className="mt-1 text-xs text-ink-muted">No allocations left. Ready for maintenance.</p> : null}</TableCell>
              <TableCell><Mono>{node.host}</Mono></TableCell>
              <TableCell><Mono>{node.version || '—'}</Mono></TableCell>
              <TableCell className="whitespace-nowrap text-ink-muted">{node.os || '—'} / {node.arch || '—'}</TableCell>
              <TableCell>{metricsError ? <span className="text-ink-muted">Unavailable</span> : <div className="grid min-w-48 grid-cols-2 gap-3"><div><Meter value={allocatedCpuPct} label={`${node.id} CPU allocated`} /><span className="text-xs text-ink-muted">{formatCpu(allocated?.cpu ?? 0)} / {formatCpu(allocatable.cpu)}</span></div><div><Meter value={allocatedMemoryPct} label={`${node.id} memory allocated`} /><span className="text-xs text-ink-muted">{formatMemory(allocated?.memory ?? 0)} / {formatMemory(allocatable.memory)}</span></div></div>}</TableCell>
              <TableCell><span className="text-xs text-ink-muted">{node.capabilities?.join(', ') || 'None reported'}</span></TableCell>
              {orgCtx.role === 'owner' ? <TableCell className="text-right"><DrainToggle nodeId={node.id} drain={node.status === 'draining'} allocationCount={activeCount} /></TableCell> : null}
              <TableCell><ChevronRight className="ml-auto size-4 text-ink-faint" /></TableCell>
            </ClickableTableRow>
          })}</TableBody>
        </Table>}
      </Panel>

      {proxies.length > 0 ? <Panel>
        <PanelHeader title="Managed ingress" hint="Whether Bower’s proxy has picked up your latest routes." />
        <Table><TableHeader><TableRow><TableHead>Proxy</TableHead><TableHead>Routes</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Updated</TableHead></TableRow></TableHeader><TableBody>
          {observedProxies.map((row) => <TableRow key={row.proxy.id}>
            <TableCell><Mono className="text-ink">{row.proxy.trellisJobName}</Mono><p className="mt-1 text-xs text-ink-muted">{row.projectName} · {row.environmentName} · port {row.proxy.port}</p></TableCell>
            <TableCell className="nums">{routeCountMap.get(row.proxy.environmentId) ?? 0}</TableCell>
            <TableCell><Chip tone={row.proxy.status === 'error' || row.observation.status === 'unhealthy' ? 'danger' : row.observation.convergence === 'converged' ? 'success' : 'warn'}>{row.proxy.status === 'error' || row.observation.status === 'unhealthy' ? 'Failed' : row.observation.convergence === 'converged' ? 'Applied' : 'Pending'}</Chip>{row.observation.diagnostic ? <p className="mt-1 max-w-md text-xs text-ink-muted">{row.observation.diagnostic}</p> : null}</TableCell>
            <TableCell className="whitespace-nowrap text-right text-ink-muted">{formatRelativeTime(row.proxy.updatedAt)}</TableCell>
          </TableRow>)}
        </TableBody></Table>
      </Panel> : null}
    </div>
  )
}
