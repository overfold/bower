import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectsForUser,
  getDeploymentsForOrg,
  getServicesForOrg,
  getAuditLog,
  getOperationalTargetsForOrg,
} from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { trellisReadError } from '@/lib/trellis-runtime'
import { TrellisReadError } from '@/components/trellis-read-error'
import { NodeLink } from '@/components/node-link'
import { parseNodeAllocatedResources } from '@/lib/trellis-resource-metrics'
import { PageHeading } from '@/components/page-heading'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { StatusDot, Chip, Dot, Meter, Mono } from '@/components/status'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeploymentPoller } from '@/components/deployment-poller'
import { DashboardStatsBar } from '@/components/dashboard-stats-bar'
import {
  Rocket,
  UserIcon,
  WebhookIcon,
  GitBranch,
  RotateCcw,
  ShieldAlert,
  BotIcon,
} from 'lucide-react'
import type { TrellisAllocation, TrellisNode, TrellisJob } from '@/types/trellis'
import { formatRelativeTime } from '@/lib/format'
import { Time } from '@/components/time'

const triggerMeta: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  manual: { icon: UserIcon, label: 'Manual' },
  webhook: { icon: WebhookIcon, label: 'Webhook' },
  promotion: { icon: GitBranch, label: 'Promotion' },
  rollback: { icon: RotateCcw, label: 'Rollback' },
  auto_rollback: { icon: ShieldAlert, label: 'Auto-rollback' },
}

function shortImage(image: string | null): string {
  if (!image) return '—'
  const parts = image.split('/')
  return parts[parts.length - 1]
}

function formatCpu(millicores: number) {
  if (millicores >= 1000) return `${(millicores / 1000).toFixed(1)}`
  return `${(millicores / 1000).toFixed(2)}`
}

function formatMemGiB(bytes: number) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(1)
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const [projectList, orgServices, allDeployments, auditEntries, targets] = await Promise.all([
    getProjectsForUser(orgCtx.org.id, user.id, orgCtx.role),
    getServicesForOrg(orgCtx.org.id),
    getDeploymentsForOrg(orgCtx.org.id, null),
    getAuditLog(orgCtx.org.id, 8),
    getOperationalTargetsForOrg(orgCtx.org.id),
  ])
  const accessibleProjectIds = new Set(projectList.map((project) => project.id))
  const accessibleProjectSlugs = new Set(projectList.map((project) => project.slug))
  const visibleServices = orgServices.filter(({ project }) => accessibleProjectIds.has(project.id))
  const visibleDeployments = allDeployments.filter((deployment) => accessibleProjectSlugs.has(deployment.projectSlug))

  // Deployment stats
  const latestByService = new Map<string, (typeof visibleDeployments)[number]>()
  for (const deployment of visibleDeployments) {
    const key = deployment.deployment.serviceId
    if (!latestByService.has(key)) latestByService.set(key, deployment)
  }
  const recentDeployments = [...latestByService.values()].slice(0, 8)
  const activeDeployments = visibleDeployments.filter(
    (d) => d.deployment.status === 'pending' || d.deployment.status === 'planning' || d.deployment.status === 'deploying'
  )
  const hasActive = activeDeployments.length > 0

  // Trellis cluster data
  let nodes: TrellisNode[] = []
  let allocations: TrellisAllocation[] = []
  let jobs: TrellisJob[] = []
  let jobsError: string | null = null
  let allocatedByNode = new Map<string, { cpu: number; memory: number }>()
  let clusterError: string | null = null
  let allocationsError: string | null = null
  let metricsError: string | null = null
  try {
    const client = await getTrellisClient(orgCtx.org.id)
    const namespaces = [...new Set(targets.filter((target) => accessibleProjectSlugs.has(target.projectSlug)).map((target) => target.namespace))]
    const [listedNodes, listedAllocations, metrics, listedJobs] = await Promise.allSettled([
      client.listNodes(),
      client.listAllocations(),
      client.getMetrics(),
      Promise.all(namespaces.map((namespace) => client.listJobs(namespace))),
    ])
    if (listedNodes.status === 'fulfilled') nodes = listedNodes.value
    else clusterError = trellisReadError(listedNodes.reason)
    if (listedAllocations.status === 'fulfilled') allocations = listedAllocations.value
    else allocationsError = trellisReadError(listedAllocations.reason)
    if (metrics.status === 'fulfilled') allocatedByNode = parseNodeAllocatedResources(metrics.value)
    else metricsError = trellisReadError(metrics.reason)
    if (listedJobs.status === 'fulfilled') jobs = listedJobs.value.flat()
    else jobsError = trellisReadError(listedJobs.reason)
  } catch (error) {
    clusterError = allocationsError = metricsError = jobsError = trellisReadError(error)
  }

  const healthyNodes = nodes.filter((n) => n.status === 'healthy').length
  const totalCpu = nodes.reduce((sum, n) => sum + n.cpu, 0)
  const allocatedCpu = nodes.reduce((sum, n) => sum + (allocatedByNode.get(n.id)?.cpu ?? 0), 0)
  const totalMem = nodes.reduce((sum, n) => sum + n.memory, 0)
  const allocatedMem = nodes.reduce((sum, n) => sum + (allocatedByNode.get(n.id)?.memory ?? 0), 0)
  const cpuPct = totalCpu > 0 ? Math.round((allocatedCpu / totalCpu) * 100) : 0
  const memPct = totalMem > 0 ? Math.round((allocatedMem / totalMem) * 100) : 0

  // One request timestamp keeps the 24-hour boundary stable for the rendered view.
  // eslint-disable-next-line react-hooks/purity
  const requestTime = Date.now()
  const failedLastDay = visibleDeployments.filter((row) => row.deployment.status === 'failed' && requestTime - row.deployment.createdAt.getTime() <= 86_400_000).length
  const unhealthyAllocations = allocations.filter((allocation) => allocation.health === 'unhealthy').length
  const backoffEntries = jobs.reduce((count, job) => count + (job.replacement_backoff?.length ?? 0), 0)
  const drainingNodes = nodes.filter((node) => node.status === 'draining').length

  return (
    <div className="min-w-0 space-y-7">
      <DeploymentPoller active={hasActive} />

      <PageHeading
        title="Overview"
        description={`${projectList.length} project${projectList.length === 1 ? '' : 's'} and ${visibleServices.length} service${visibleServices.length === 1 ? '' : 's'}.`}
      />

      <Panel className="overflow-hidden">
        <PanelHeader title="Needs attention" />
        {clusterError || allocationsError || jobsError ? <p className="px-4 pt-3 text-sm text-warn-500">Cluster diagnostics incomplete — current issues may be missing.</p> : null}
        {failedLastDay + unhealthyAllocations + backoffEntries + drainingNodes === 0 ? <p className="px-4 py-3 text-sm text-ink-soft">{clusterError || allocationsError || jobsError ? 'No issues found in available data.' : 'All clear — no current issues.'}</p> : <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 text-sm">
          {failedLastDay > 0 ? <Link href="/deployments" className="font-medium text-danger-500 hover:underline">{failedLastDay} failed deployment{failedLastDay === 1 ? '' : 's'} in 24h</Link> : null}
          {unhealthyAllocations > 0 ? <Link href="/status" className="font-medium text-danger-500 hover:underline">{unhealthyAllocations} unhealthy allocation{unhealthyAllocations === 1 ? '' : 's'}</Link> : null}
          {drainingNodes > 0 ? <Link href="/status" className="font-medium text-warn-500 hover:underline">{drainingNodes} draining node{drainingNodes === 1 ? '' : 's'}</Link> : null}
          {backoffEntries > 0 ? <Link href="/status" className="font-medium text-warn-500 hover:underline">{backoffEntries} replacement backoff {backoffEntries === 1 ? 'entry' : 'entries'}</Link> : null}
        </div>}
      </Panel>

      <DashboardStatsBar
        allocations={allocations}
        clusterAvailable={!allocationsError}
        capacityAvailable={!clusterError && !metricsError}
        capacity={{
          cpuAllocated: allocatedCpu,
          cpuTotal: totalCpu,
          memoryAllocated: allocatedMem,
          memoryTotal: totalMem,
        }}
        deployments={visibleDeployments.map((row) => ({
          createdAt: row.deployment.createdAt,
          status: row.deployment.status,
        }))}
      />
      {(clusterError || allocationsError || metricsError) && <Panel>
        {clusterError && <TrellisReadError title="Nodes unavailable" message={clusterError} />}
        {allocationsError && <TrellisReadError title="Allocations unavailable" message={allocationsError} />}
        {metricsError && <TrellisReadError title="Capacity data unavailable" message={metricsError} />}
      </Panel>}

      {/* Active deployments alert */}
      {hasActive && (
        <Panel className="overflow-hidden">
          <PanelHeader
            title={`In flight · ${activeDeployments.length} deployment${activeDeployments.length === 1 ? '' : 's'}`}
            action={
              <Link
                href="/deployments"
                className="text-link text-sm font-medium"
              >
                View all
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {activeDeployments.map((row) => {
              const meta = triggerMeta[row.deployment.triggerType] ?? triggerMeta.manual
              const TriggerIcon = meta.icon
              return (
                <li key={row.deployment.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                  <StatusDot status={row.deployment.status} />
                  <span className="text-sm font-medium text-ink">
                    {row.projectName} / {row.serviceName}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className="text-ink-muted">→</span>
                    <span className="text-ink-muted">
                      {row.environmentName}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-ink-muted">Image</span>
                    <Mono className="text-ink">{shortImage(row.deployment.imageAfter)}</Mono>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-ink-muted">
                    <TriggerIcon className="h-3.5 w-3.5" />
                    {meta.label} by {row.userName ?? 'System'}
                  </span>
                  <span className="ml-auto text-sm text-ink-muted">
                    started {formatRelativeTime(row.deployment.createdAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Left column */}
        <div className="min-w-0 space-y-5">
          {/* Recent deployments */}
          <Panel className="min-w-0 overflow-hidden">
            <PanelHeader
              title="Recent deployments"
              action={
                <Link
                  href="/deployments"
                  className="text-link text-sm font-medium"
                >
                  View all
                </Link>
              }
            />
            {recentDeployments.length === 0 ? (
              <EmptyState
                icon={<Rocket className="h-4 w-4" />}
                title="No deployments yet"
                body="Deploy a service to see deployment history here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDeployments.map((row) => {
                    const meta = triggerMeta[row.deployment.triggerType] ?? triggerMeta.manual
                    const TriggerIcon = meta.icon
                    return (
                      <TableRow key={row.deployment.id}>
                        <TableCell>
                          <Link
                            href={`/projects/${row.projectSlug}/services/${row.serviceSlug}`}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                          >
                            {row.serviceName}
                          </Link>
                          <p className="mt-0.5 text-2xs text-ink-muted">{row.projectName}</p>
                        </TableCell>
                        <TableCell><Mono>{shortImage(row.deployment.imageAfter)}</Mono></TableCell>
                        <TableCell>
                          <StatusDot status={row.deployment.status} />
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            <TriggerIcon className="h-3.5 w-3.5 text-ink-faint" />
                            <span className="text-sm text-ink-soft">{meta.label}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap text-ink-muted">
                          <Time value={row.deployment.createdAt} mode="auto" />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Panel>
        </div>

        {/* Right column */}
        <div className="min-w-0 space-y-5">
          {/* Cluster health */}
          {!clusterError && nodes.length > 0 && (
            <Panel>
              <PanelHeader
                title="Cluster"
                hint={orgCtx.org.trellisApiUrl?.replace(/^https?:\/\//, '').replace(/\/+$/, '')}
                action={
                  <Chip tone={nodes.some((node) => node.status === 'unhealthy') ? 'danger' : drainingNodes > 0 ? 'warn' : 'success'}>
                    <Dot tone={nodes.some((node) => node.status === 'unhealthy') ? 'danger' : drainingNodes > 0 ? 'warn' : 'success'} />
                    {nodes.some((node) => node.status === 'unhealthy') ? `${nodes.length - healthyNodes} unhealthy` : drainingNodes > 0 ? `${drainingNodes} draining` : 'All healthy'}
                  </Chip>
                }
              />
              {metricsError ? <TrellisReadError title="Capacity data unavailable" message={metricsError} /> : <div className="space-y-3 px-4 py-3.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-ink-soft">CPU allocated</span>
                  <span className="flex items-center gap-3">
                    <span className="nums text-xs text-ink-muted">
                      {formatCpu(allocatedCpu)} / {formatCpu(totalCpu)} cores
                    </span>
                    <Meter value={cpuPct} label="Cluster CPU allocated" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-ink-soft">Memory allocated</span>
                  <span className="flex items-center gap-3">
                    <span className="nums text-xs text-ink-muted">
                      {formatMemGiB(allocatedMem)} / {formatMemGiB(totalMem)} GiB
                    </span>
                    <Meter value={memPct} label="Cluster memory allocated" />
                  </span>
                </div>
              </div>}
              <ul className="divide-y divide-line border-t border-line">
                {nodes.map((node) => (
                  <li key={node.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <Dot tone={node.status === 'healthy' ? 'success' : node.status === 'draining' ? 'warn' : 'danger'} />
                      <NodeLink id={node.id} className="truncate text-sm" />
                    </span>
                    <span className="shrink-0">
                      <Mono>{node.version}</Mono>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-4 py-3">
                <Link
                  href="/status"
                  className="text-link text-sm font-medium"
                >
                  Cluster &amp; managed ingress
                </Link>
              </div>
            </Panel>
          )}

          {/* Recent activity */}
          <Panel>
            <PanelHeader
              title="Recent activity"
              action={
                <Link
                  href="/audit"
                  className="text-link text-sm font-medium"
                >
                  View all
                </Link>
              }
            />
            {auditEntries.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-ink-muted">No activity yet.</div>
            ) : (
              <ul className="divide-y divide-line">
                {auditEntries.map((entry) => {
                  const isSystem = !entry.userName
                  const ActorIcon = isSystem ? BotIcon : UserIcon
                  return (
                    <li key={entry.entry.id} className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-muted">
                          <ActorIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-ink">
                              {entry.entry.action}
                            </span>
                          </span>
                          <p className="mt-0.5 truncate text-xs text-ink-muted">
                            {entry.userName ?? 'System'} · {formatRelativeTime(entry.entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
