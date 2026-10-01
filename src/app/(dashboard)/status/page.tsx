import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getManagedProxiesForOrg, getOperationalTargetsForOrg, getRouteCountsByEnvironment, getUserOrganization } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import {
  managedProxyObservation,
  nodeAllocatable,
  nodeCapacity,
  pendingReasonCounts,
  trellisReadError,
} from '@/lib/trellis-runtime'
import { TrellisReadError } from '@/components/trellis-read-error'
import { NodeLink } from '@/components/node-link'
import { parseNodeAllocatedResources } from '@/lib/trellis-resource-metrics'
import { PageHeading } from '@/components/page-heading'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { Chip, Dot, Meter, Mono } from '@/components/status'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Server } from 'lucide-react'
import { DrainToggle } from './drain-toggle'
import { ResetBackoffButton } from './reset-backoff-button'
import { formatBytes, formatCpu } from './format'
import type { TrellisAllocation, TrellisJob, TrellisNode } from '@/types/trellis'
import { formatRelativeTime, formatTimestamp } from '@/lib/format'

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
      else if (allocationResult?.status === 'rejected') operationsError ??= trellisReadError(allocationResult.reason)
      if (jobResult?.status === 'fulfilled') jobs.push(...(jobResult.value as TrellisJob[]).map((job) => ({ namespace, job })))
      else if (jobResult?.status === 'rejected') operationsError ??= trellisReadError(jobResult.reason)
    })
  } catch (error) {
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

  return (
    <div className="space-y-6">
      <PageHeading title="Cluster" description="Monitor cluster capacity, placement, replacement backoff, and managed ingress." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Connection" hint={clusterError ? 'Unhealthy' : 'Healthy'} />
          <dl className="px-4"><KeyValue label="Control-plane API" mono>{orgCtx.org.trellisApiUrl ?? '—'}</KeyValue></dl>
          {clusterError ? <TrellisReadError title="Node data unavailable" message={clusterError} /> : null}
        </Panel>
        <Panel>
          <PanelHeader title="Capacity" hint={`${nodes.length} node${nodes.length === 1 ? '' : 's'}`} />
          {metricsError || clusterError ? <TrellisReadError title="Capacity data unavailable" message={metricsError || clusterError!} /> : <div className="grid gap-5 p-4 sm:grid-cols-2">
            <div><span className="text-[13px] text-ink-soft">CPU allocated · {formatCpu(allocatedCpu)} / {formatCpu(totalAllocatableCpu)}</span><div className="mt-2"><Meter value={cpuPct} label="Cluster CPU allocated" /></div></div>
            <div><span className="text-[13px] text-ink-soft">Memory allocated · {formatBytes(allocatedMemory)} / {formatBytes(totalAllocatableMemory)}</span><div className="mt-2"><Meter value={memoryPct} label="Cluster memory allocated" /></div></div>
          </div>}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Pending allocations" hint={pending.length ? `${pending.length} waiting across ${reasonCounts.length} reason${reasonCounts.length === 1 ? '' : 's'}` : 'No placement backlog'} />
        {operationsError ? <TrellisReadError title="Allocation diagnostics incomplete" message={operationsError} /> : null}
        {pending.length === 0 && !operationsError ? <div className="p-4 text-[13px] text-ink-muted">All requested allocations have progressed beyond placement.</div> : pending.length > 0 ? <>
          <div className="flex flex-wrap gap-2 border-b border-line p-4">{reasonCounts.map(({ reason, count }) => <Chip key={reason} tone="warn"><span className="nums">{count}</span> {reason.replaceAll('_', ' ')}</Chip>)}</div>
          <Table><TableHeader><TableRow><TableHead>Allocation</TableHead><TableHead>Workload</TableHead><TableHead>Reason</TableHead><TableHead>Waiting</TableHead></TableRow></TableHeader><TableBody>
            {pending.map((allocation) => {
              const target = targetFor(allocation)
              const href = target ? `/projects/${target.projectSlug}/services/${target.serviceSlug}/allocations/${allocation.id}` : null
              return <TableRow key={`${allocation.namespace}/${allocation.id}`}>
                <TableCell>{href ? <Link href={href} className="font-mono text-xs font-medium text-brand-500 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-500">{allocation.id.length > 12 ? `${allocation.id.slice(0, 12)}…` : allocation.id}</Link> : <Mono>{allocation.id.length > 12 ? `${allocation.id.slice(0, 12)}…` : allocation.id}</Mono>}</TableCell>
                <TableCell><div className="text-ink">{target?.serviceName ?? allocation.job}</div><div className="text-xs text-ink-muted">{target ? `${target.projectName} · ${target.environmentName}` : allocation.namespace}</div></TableCell>
                <TableCell><Chip tone="warn">{(allocation.reason || 'awaiting_placement').replaceAll('_', ' ')}</Chip>{allocation.message ? <p className="mt-1 max-w-md text-xs text-ink-muted">{allocation.message}</p> : null}</TableCell>
                <TableCell className="text-ink-muted">{formatRelativeTime(allocation.created_at)}</TableCell>
              </TableRow>
            })}
          </TableBody></Table>
        </> : null}
      </Panel>

      {backoffs.length > 0 ? <Panel>
        <PanelHeader title="Replacement backoff" hint="Repeated failures delay new placements; reset only after correcting the cause." />
        <Table><TableHeader><TableRow><TableHead>Job / group</TableHead><TableHead>Failures</TableHead><TableHead>Last failure</TableHead><TableHead>Next replacement</TableHead><TableHead /></TableRow></TableHeader><TableBody>
          {backoffs.map(({ namespace, job, backoff }) => {
            const target = targetForJob(namespace, job)
            return <TableRow key={`${namespace}/${job}/${backoff.group}`}>
              <TableCell>{target ? <Link href={`/projects/${target.projectSlug}/services/${target.serviceSlug}`} className="font-medium text-brand-500 hover:underline">{job} / {backoff.group}</Link> : <Mono>{job} / {backoff.group}</Mono>}<p className="mt-1 text-xs text-ink-muted">{namespace}</p></TableCell>
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
        {clusterError ? <TrellisReadError title="Nodes unavailable" message={clusterError} /> : nodes.length === 0 ? <EmptyState icon={<Server className="h-4 w-4" />} title="No nodes" body="No nodes are registered with this cluster." /> : <Table>
          <TableHeader><TableRow><TableHead>Node</TableHead><TableHead>IP</TableHead><TableHead>Version</TableHead><TableHead>OS</TableHead><TableHead>Allocated</TableHead><TableHead>Capabilities</TableHead><TableHead className="text-right">Drain</TableHead></TableRow></TableHeader>
          <TableBody>{nodes.map((node) => {
            const allocated = allocatedByNode.get(node.id)
            const allocatable = nodeAllocatable(node)
            const capacity = nodeCapacity(node)
            const allocatedCpuPct = allocatable.cpu > 0 ? Math.round((allocated?.cpu ?? 0) / allocatable.cpu * 100) : 0
            const allocatedMemoryPct = allocatable.memory > 0 ? Math.round((allocated?.memory ?? 0) / allocatable.memory * 100) : 0
            return <TableRow key={node.id}>
              <TableCell><div className="flex items-center gap-1.5"><Dot tone={node.status === 'healthy' ? 'brand' : node.status === 'draining' ? 'warn' : 'danger'} /><NodeLink id={node.id} /></div></TableCell>
              <TableCell><Mono>{node.host}</Mono></TableCell>
              <TableCell><Mono>{node.version || '—'}</Mono></TableCell>
              <TableCell className="whitespace-nowrap text-ink-muted">{node.os || '—'} / {node.arch || '—'}</TableCell>
              <TableCell>{metricsError ? <span className="text-ink-muted">Unavailable</span> : <div className="space-y-2"><div><Meter value={allocatedCpuPct} label={`${node.id.slice(0, 8)} CPU allocated`} /><span className="text-xs text-ink-muted">{formatCpu(allocated?.cpu ?? 0)} / {formatCpu(allocatable.cpu)} allocatable</span></div><div><Meter value={allocatedMemoryPct} label={`${node.id.slice(0, 8)} memory allocated`} /><span className="text-xs text-ink-muted">{formatBytes(allocated?.memory ?? 0)} / {formatBytes(allocatable.memory)} allocatable</span></div><p className="text-xs text-ink-muted">Physical: {formatCpu(capacity.cpu)} · {formatBytes(capacity.memory)}</p></div>}</TableCell>
              <TableCell><div className="flex max-w-52 flex-wrap gap-1">{node.capabilities?.length ? node.capabilities.map((capability) => <Chip key={capability}>{capability}</Chip>) : <span className="text-xs text-ink-muted">None reported</span>}</div></TableCell>
              <TableCell className="text-right"><DrainToggle nodeId={node.id} drain={node.status === 'draining'} /></TableCell>
            </TableRow>
          })}</TableBody>
        </Table>}
      </Panel>

      {proxies.length > 0 ? <Panel>
        <PanelHeader title="Managed ingress" hint="Submission state is distinct from observed listener and route discovery convergence." />
        <Table><TableHeader><TableRow><TableHead>Target</TableHead><TableHead>Routes</TableHead><TableHead>Submission</TableHead><TableHead>Observed convergence</TableHead><TableHead className="text-right">Submitted</TableHead></TableRow></TableHeader><TableBody>
          {observedProxies.map((row) => <TableRow key={row.proxy.id}>
            <TableCell><Mono className="text-ink">{row.proxy.trellisJobName}</Mono><p className="mt-1 text-xs text-ink-muted">{row.projectName} · {row.environmentName} · port {row.proxy.port}</p></TableCell>
            <TableCell className="nums">{routeCountMap.get(row.proxy.environmentId) ?? 0}</TableCell>
            <TableCell><Chip tone={row.proxy.status === 'error' ? 'danger' : 'neutral'}>{row.proxy.status === 'error' ? 'Apply failed' : 'Accepted'}</Chip><p className="mt-1 font-mono text-2xs text-ink-muted">target {row.proxy.configHash?.slice(0, 10) || 'unknown'}</p></TableCell>
            <TableCell><span className="flex items-center gap-1.5 capitalize"><Dot tone={row.observation.status === 'running' ? 'brand' : row.observation.status === 'pending' ? 'warn' : 'danger'} pulse={row.observation.status === 'pending'} />{row.observation.convergence === 'converged' ? 'Converged' : row.observation.status}</span>{row.observation.failureKind ? <p className="mt-1 text-xs font-medium text-danger-500">{row.observation.failureKind === 'route-sync' ? 'Route discovery / sync failed' : row.observation.failureKind === 'listener' ? 'Listener check failed' : 'Managed listener or route-sync health check failed'}</p> : null}{row.observation.diagnostic ? <p className="mt-1 max-w-md text-xs text-ink-muted">{row.observation.diagnostic}</p> : null}</TableCell>
            <TableCell className="whitespace-nowrap text-right text-ink-muted">{formatRelativeTime(row.proxy.updatedAt)}</TableCell>
          </TableRow>)}
        </TableBody></Table>
      </Panel> : null}
    </div>
  )
}
