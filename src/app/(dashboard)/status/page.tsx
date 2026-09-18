import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getManagedProxiesForOrg,
  getRouteCountsByEnvironment,
} from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { parseNodeAllocatedResources } from '@/lib/trellis-resource-metrics'
import { PageHeading } from '@/components/page-heading'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { Chip, Dot, Meter, Mono } from '@/components/status'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Server } from 'lucide-react'
import { DrainToggle } from './drain-toggle'
import type { TrellisNode } from '@/types/trellis'

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

function formatNodeAddress(node: TrellisNode): string {
  const host = node.host.includes(':') && !node.host.startsWith('[')
    ? `[${node.host}]`
    : node.host
  return `${host}:${node.port}`
}

export default async function StatusPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  let nodes: TrellisNode[] = []
  let allocatedByNode = new Map<string, { cpu: number; memory: number }>()
  let clusterError: string | null = null

  try {
    const client = await getTrellisClient(orgCtx.org.id)
    const [listedNodes, metrics] = await Promise.all([
      client.listNodes(),
      client.getMetrics(),
    ])
    nodes = listedNodes
    allocatedByNode = parseNodeAllocatedResources(metrics)
  } catch (err) {
    clusterError = err instanceof Error ? err.message : 'Failed to connect to cluster.'
  }

  const [proxies, routeCounts] = await Promise.all([
    getManagedProxiesForOrg(orgCtx.org.id),
    getRouteCountsByEnvironment(orgCtx.org.id),
  ])

  const routeCountMap = new Map(routeCounts.map((r) => [r.environmentId, r.count]))

  const totalCpu = nodes.reduce((sum, n) => sum + n.cpu, 0)
  const allocatedCpu = nodes.reduce((sum, n) => sum + (allocatedByNode.get(n.id)?.cpu ?? 0), 0)
  const totalMem = nodes.reduce((sum, n) => sum + n.memory, 0)
  const allocatedMem = nodes.reduce((sum, n) => sum + (allocatedByNode.get(n.id)?.memory ?? 0), 0)
  const cpuPct = totalCpu > 0 ? Math.round((allocatedCpu / totalCpu) * 100) : 0
  const memPct = totalMem > 0 ? Math.round((allocatedMem / totalMem) * 100) : 0

  if (clusterError) {
    return (
      <div className="space-y-6">
        <PageHeading
          title="Cluster"
          description="Monitor cluster connectivity, capacity, nodes, and managed ingress."
        />
        <Panel>
          <EmptyState
            icon={<Server className="h-4 w-4" />}
            title="Unable to reach cluster"
            body={clusterError}
          />
        </Panel>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Cluster"
        description="Monitor cluster connectivity, capacity, nodes, and managed ingress."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Connection"
            action={
              <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                <Dot tone="brand" />
                Connected
              </span>
            }
          />
          <dl className="px-4">
            <KeyValue label="Control-plane API" mono>
              {orgCtx.org.trellisApiUrl ?? '—'}
            </KeyValue>
          </dl>
        </Panel>

        <Panel>
          <PanelHeader title="Capacity" hint={`${nodes.length} node${nodes.length === 1 ? '' : 's'}`} />
          <div className="grid gap-5 p-4 sm:grid-cols-2">
            <div>
              <span className="text-[13px] text-ink-soft">CPU allocated</span>
              <div className="mt-2">
                <Meter value={cpuPct} label="Cluster CPU allocated" />
              </div>
            </div>
            <div>
              <span className="text-[13px] text-ink-soft">Memory allocated</span>
              <div className="mt-2">
                <Meter value={memPct} label="Cluster memory allocated" />
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Nodes" />
        {nodes.length === 0 ? (
          <EmptyState
            icon={<Server className="h-4 w-4" />}
            title="No nodes"
            body="No nodes are registered with this cluster."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Node</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Arch</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Drain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((node) => {
                const allocated = allocatedByNode.get(node.id)
                const nodeCpuPct = node.cpu > 0 ? Math.round(((allocated?.cpu ?? 0) / node.cpu) * 100) : 0
                const nodeMemPct = node.memory > 0 ? Math.round(((allocated?.memory ?? 0) / node.memory) * 100) : 0
                return (
                  <TableRow key={node.id}>
                    <TableCell className="font-medium text-ink">{node.id}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 capitalize">
                        <Dot
                          tone={
                            node.status === 'healthy'
                              ? 'brand'
                              : node.status === 'draining'
                                ? 'warn'
                                : 'danger'
                          }
                        />
                        {node.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Mono>{formatNodeAddress(node)}</Mono>
                    </TableCell>
                    <TableCell>
                      <Meter value={nodeCpuPct} label={`${node.id} CPU allocated`} />
                    </TableCell>
                    <TableCell>
                      <Meter value={nodeMemPct} label={`${node.id} memory allocated`} />
                    </TableCell>
                    <TableCell>
                      <Chip tone="neutral">{node.arch}</Chip>
                    </TableCell>
                    <TableCell>
                      <Mono>{node.version}</Mono>
                    </TableCell>
                    <TableCell className="text-right">
                      <DrainToggle
                        nodeId={node.id}
                        drain={node.status === 'draining'}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      {proxies.length > 0 && (
        <Panel>
          <PanelHeader title="Managed ingress" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Routes</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proxies.map((row) => (
                <TableRow key={row.proxy.id}>
                  <TableCell>
                    <Mono className="text-ink">{row.proxy.trellisJobName}</Mono>
                  </TableCell>
                  <TableCell>{row.environmentName}</TableCell>
                  <TableCell className="text-ink-muted">{row.projectName}</TableCell>
                  <TableCell className="nums">
                    {routeCountMap.get(row.proxy.environmentId) ?? 0}
                  </TableCell>
                  <TableCell>
                    <Mono>{row.proxy.port}</Mono>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 capitalize">
                      <Dot
                        tone={
                          row.proxy.status === 'running'
                            ? 'brand'
                            : row.proxy.status === 'pending'
                              ? 'warn'
                              : 'danger'
                        }
                        pulse={row.proxy.status === 'pending'}
                      />
                      {row.proxy.status}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-ink-muted">
                    {relTime(row.proxy.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  )
}
