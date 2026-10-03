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
import { StatusDot, DeploymentStatus, Chip, Dot, Mono } from '@/components/status'
import { EmptyState } from '@/components/ui/empty-state'
import { DeploymentPoller } from '@/components/deployment-poller'
import { DashboardStatsBar } from '@/components/dashboard-stats-bar'
import { DeploymentsTable } from '@/components/deployments-table'
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
import { currentJobAllocations } from '@/lib/service-health'
import { auditActionSentence, auditResourceName } from '@/lib/labels'
import { NeedsAttention } from '@/components/needs-attention'
import { needsAttentionRows } from '@/lib/needs-attention'

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

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const [projectList, orgServices, allDeployments, auditEntries, targets] = await Promise.all([
    getProjectsForUser(orgCtx.org.id, user.id, orgCtx.role),
    getServicesForOrg(orgCtx.org.id),
    getDeploymentsForOrg(orgCtx.org.id, null),
    getAuditLog(orgCtx.org.id, 5),
    getOperationalTargetsForOrg(orgCtx.org.id),
  ])
  const accessibleProjectIds = new Set(projectList.map((project) => project.id))
  const accessibleProjectSlugs = new Set(projectList.map((project) => project.slug))
  const visibleServices = orgServices.filter(({ project }) => accessibleProjectIds.has(project.id))
  const visibleDeployments = allDeployments.filter((deployment) => accessibleProjectSlugs.has(deployment.projectSlug))

  // Deployment stats
  const recentDeployments = visibleDeployments.slice(0, 8)
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

  const totalCpu = nodes.reduce((sum, n) => sum + n.cpu, 0)
  const allocatedCpu = nodes.reduce((sum, n) => sum + (allocatedByNode.get(n.id)?.cpu ?? 0), 0)
  const totalMem = nodes.reduce((sum, n) => sum + n.memory, 0)
  const allocatedMem = nodes.reduce((sum, n) => sum + (allocatedByNode.get(n.id)?.memory ?? 0), 0)
  // One request timestamp keeps the 24-hour boundary stable for the rendered view.
  // eslint-disable-next-line react-hooks/purity
  const requestTime = Date.now()
  const currentAllocations = currentJobAllocations(allocations, jobs)
  const visibleTargets = targets.filter((target) => accessibleProjectSlugs.has(target.projectSlug))
  const isDrained = (node: TrellisNode) => !allocationsError && node.status === 'draining' && !allocations.some((allocation) => allocation.node_id === node.id && !['stopped', 'failed', 'lost', 'completed', 'dead'].includes(allocation.phase))
  const drainingNodes = nodes.filter((node) => node.status === 'draining' && !isDrained(node)).length
  const drainedNodes = nodes.filter(isDrained).length
  const attentionRows = needsAttentionRows({ deployments: visibleDeployments, allocations: currentAllocations, jobs, targets: visibleTargets, nodes, now: requestTime })
  if (clusterError || allocationsError || jobsError) attentionRows.unshift({ id: 'cluster-error', status: 'unknown', serviceName: 'Cluster health', cause: 'Couldn’t check the cluster', href: '/status', action: 'Open status' })
  const resourceNames = new Map<string, string>(projectList.map((project) => [project.id, project.name]))
  for (const { service } of visibleServices) resourceNames.set(service.id, service.name)
  for (const row of visibleDeployments) resourceNames.set(row.deployment.id, row.serviceName)

  return (
    <div className="min-w-0 space-y-7">
      <DeploymentPoller active={hasActive} />

      <PageHeading
        title="Home"
      />

      <NeedsAttention rows={attentionRows} />

      <DashboardStatsBar
        allocations={currentAllocations}
        clusterAvailable={!allocationsError && !jobsError}
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
                  <DeploymentStatus status={row.deployment.status} />
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
              <DeploymentsTable rows={recentDeployments} preset="home" />
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
                hint={orgCtx.org.trellisApiUrl ? <Mono>{orgCtx.org.trellisApiUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')}</Mono> : undefined}
                action={
                  <div className="flex items-center gap-3"><Link href="/status" className="text-link text-sm font-medium">View status</Link><Chip tone={nodes.some((node) => node.status === 'unhealthy') ? 'danger' : drainingNodes > 0 ? 'warn' : drainedNodes > 0 ? 'neutral' : 'success'}>
                    <Dot tone={nodes.some((node) => node.status === 'unhealthy') ? 'danger' : drainingNodes > 0 ? 'warn' : drainedNodes > 0 ? 'neutral' : 'success'} />
                    {nodes.some((node) => node.status === 'unhealthy') ? `${nodes.filter((node) => node.status === 'unhealthy').length} unhealthy` : drainingNodes > 0 ? `${drainingNodes} draining` : drainedNodes > 0 ? `${drainedNodes} drained` : 'All healthy'}
                  </Chip></div>
                }
              />
              <ul className="divide-y divide-line border-t border-line">
                {nodes.map((node) => (
                  <li key={node.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <NodeLink id={node.id} className="truncate text-sm" />
                    </span>
                    <span className="shrink-0">
                      <StatusDot status={isDrained(node) ? 'drained' : node.status === 'healthy' ? 'ready' : node.status} />
                    </span>
                  </li>
                ))}
              </ul>
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
                              {entry.userName ?? 'System'} {auditActionSentence(entry.entry.action, auditResourceName({ resourceName: resourceNames.get(entry.entry.resourceId), details: entry.entry.details as Record<string, unknown>, resourceType: entry.entry.resourceType }), entry.entry.details as Record<string, unknown>)}
                            </span>
                          </span>
                          <p className="mt-0.5 truncate text-xs text-ink-muted">
                            {entry.entry.action} · {formatRelativeTime(entry.entry.createdAt)}
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
