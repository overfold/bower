import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectsForUser,
  getDeploymentsForOrg,
  getServicesForOrg,
  getEnvironmentsByProject,
  getRoutesByProject,
  getAuditLog,
} from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
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
import {
  FolderKanban,
  Rocket,
  UserIcon,
  WebhookIcon,
  GitBranch,
  RotateCcw,
  ShieldAlert,
  BotIcon,
} from 'lucide-react'
import type { TrellisNode } from '@/types/trellis'

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

  const [projectList, orgServices, allDeployments, auditEntries] = await Promise.all([
    getProjectsForUser(orgCtx.org.id, user.id, orgCtx.role),
    getServicesForOrg(orgCtx.org.id),
    getDeploymentsForOrg(orgCtx.org.id, 50),
    getAuditLog(orgCtx.org.id, 8),
  ])

  const envCounts = await Promise.all(
    projectList.map((p) => getEnvironmentsByProject(p.id).then((e) => e.length))
  )
  const totalEnvironments = envCounts.reduce((sum, c) => sum + c, 0)

  const routeCounts = await Promise.all(
    projectList.map((p) => getRoutesByProject(p.id).then((r) => r.length))
  )
  const totalRoutes = routeCounts.reduce((sum, c) => sum + c, 0)

  // Deployment stats
  const recentDeployments = allDeployments.slice(0, 8)
  const activeDeployments = allDeployments.filter(
    (d) => d.deployment.status === 'pending' || d.deployment.status === 'planning' || d.deployment.status === 'deploying'
  )
  const hasActive = activeDeployments.length > 0

  const completedDeployments = allDeployments.filter(
    (d) => d.deployment.status === 'healthy' || d.deployment.status === 'failed' || d.deployment.status === 'rolled_back'
  )
  const healthyCount = completedDeployments.filter((d) => d.deployment.status === 'healthy').length
  const successRate = completedDeployments.length > 0
    ? Math.round((healthyCount / completedDeployments.length) * 100)
    : 100

  // Trellis cluster data
  let nodes: TrellisNode[] = []
  let clusterError: string | null = null
  try {
    const client = await getTrellisClient(orgCtx.org.id)
    nodes = await client.listNodes()
  } catch {
    clusterError = 'Not configured'
  }

  const healthyNodes = nodes.filter((n) => n.status === 'healthy').length
  const totalCpu = nodes.reduce((sum, n) => sum + n.cpu, 0)
  const usedCpu = nodes.reduce((sum, n) => sum + (n.cpu_used ?? 0), 0)
  const totalMem = nodes.reduce((sum, n) => sum + n.memory, 0)
  const usedMem = nodes.reduce((sum, n) => sum + (n.memory_used ?? 0), 0)
  const cpuPct = totalCpu > 0 ? Math.round((usedCpu / totalCpu) * 100) : 0
  const memPct = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0

  // Greeting based on time
  const hour = new Date().getUTCHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = user.name.split(' ')[0]

  // Summary description
  const parts: string[] = []
  parts.push(`${projectList.length} project${projectList.length === 1 ? '' : 's'} and ${orgServices.length} service${orgServices.length === 1 ? '' : 's'}`)
  if (hasActive) {
    parts.push(`${activeDeployments.length} deployment${activeDeployments.length === 1 ? '' : 's'} in flight`)
  }

  return (
    <div className="min-w-0 space-y-7">
      <DeploymentPoller active={hasActive} />

      <PageHeading
        title={`${greeting}, ${firstName}.`}
        description={`${parts.join('. ')}.`}
      />

      {/* Active deployments alert */}
      {hasActive && (
        <Panel className="overflow-hidden">
          <PanelHeader
            title={`In flight · ${activeDeployments.length} deployment${activeDeployments.length === 1 ? '' : 's'}`}
            action={
              <Link
                href="/deployments"
                className="rounded text-[12.5px] font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
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
                  <span className="text-[13px] font-medium text-ink">
                    {row.projectName} / {row.serviceName}
                  </span>
                  <span className="flex items-center gap-1.5 text-[13px]">
                    <span className="text-ink-muted">→</span>
                    <Chip tone={row.environmentName === 'production' ? 'info' : 'neutral'}>
                      {row.environmentName}
                    </Chip>
                  </span>
                  <span className="flex items-center gap-2 text-[13px]">
                    <span className="text-ink-muted">Image</span>
                    <Mono className="text-ink">{shortImage(row.deployment.imageAfter)}</Mono>
                  </span>
                  <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                    <TriggerIcon className="h-3.5 w-3.5" />
                    {meta.label} by {row.userName ?? 'System'}
                  </span>
                  <span className="ml-auto text-[12.5px] text-ink-muted">
                    started {relTime(row.deployment.createdAt)}
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
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            <Panel>
              <div className="p-4">
                <p className="text-xs text-ink-muted">Services</p>
                <p className="nums mt-1 text-xl font-semibold tracking-tight text-ink">{orgServices.length}</p>
              </div>
            </Panel>
            <Panel>
              <div className="p-4">
                <p className="text-xs text-ink-muted">Success rate</p>
                <p className="nums mt-1 text-xl font-semibold tracking-tight text-ink">{successRate}%</p>
              </div>
            </Panel>
            <Panel>
              <div className="p-4">
                <p className="text-xs text-ink-muted">Environments</p>
                <p className="nums mt-1 text-xl font-semibold tracking-tight text-ink">{totalEnvironments}</p>
              </div>
            </Panel>
            <Panel>
              <div className="p-4">
                <p className="text-xs text-ink-muted">Routes</p>
                <p className="nums mt-1 text-xl font-semibold tracking-tight text-ink">{totalRoutes}</p>
              </div>
            </Panel>
          </div>

          {/* Recent deployments */}
          <Panel className="min-w-0 overflow-hidden">
            <PanelHeader
              title="Recent deployments"
              action={
                <Link
                  href="/deployments"
                  className="rounded text-[12.5px] font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
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
                    <TableHead>Environment</TableHead>
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
                        <TableCell>
                          <Chip tone={row.environmentName === 'production' ? 'info' : 'neutral'}>
                            {row.environmentName}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <StatusDot status={row.deployment.status} />
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            <TriggerIcon className="h-3.5 w-3.5 text-ink-faint" />
                            <span className="text-[12.5px] text-ink-soft">{meta.label}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap text-ink-muted">
                          {relTime(row.deployment.createdAt)}
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
                  <Chip tone="brand">
                    <Dot tone="brand" />
                    {healthyNodes}/{nodes.length} healthy
                  </Chip>
                }
              />
              <div className="space-y-3 px-4 py-3.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-ink-soft">CPU</span>
                  <span className="flex items-center gap-3">
                    <span className="nums text-xs text-ink-muted">
                      {formatCpu(usedCpu)} / {formatCpu(totalCpu)} cores
                    </span>
                    <Meter value={cpuPct} label="Cluster CPU" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-ink-soft">Memory</span>
                  <span className="flex items-center gap-3">
                    <span className="nums text-xs text-ink-muted">
                      {formatMemGiB(usedMem)} / {formatMemGiB(totalMem)} GiB
                    </span>
                    <Meter value={memPct} label="Cluster memory" />
                  </span>
                </div>
              </div>
              <ul className="divide-y divide-line border-t border-line">
                {nodes.map((node) => (
                  <li key={node.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <Dot tone={node.status === 'healthy' ? 'brand' : node.status === 'draining' ? 'warn' : 'danger'} />
                      <span className="truncate text-[13px] text-ink">{node.id}</span>
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
                  className="rounded text-[12.5px] font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
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
              hint="Audit log"
              action={
                <Link
                  href="/settings/audit"
                  className="rounded text-[12.5px] font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                >
                  View all
                </Link>
              }
            />
            {auditEntries.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-ink-muted">No activity yet.</div>
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
                            <code className="font-mono text-[12.5px] font-medium text-ink">
                              {entry.entry.action}
                            </code>
                          </span>
                          <p className="mt-0.5 truncate text-xs text-ink-muted">
                            {entry.userName ?? 'System'} · {relTime(entry.entry.createdAt)}
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

      {/* Empty state when no projects */}
      {projectList.length === 0 && (
        <EmptyState
          icon={<FolderKanban className="h-4 w-4" />}
          title="No projects yet"
          body="Create your first project to get started with deployments."
          action={
            <Link
              href="/projects"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-500 px-3.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand-600"
            >
              <Rocket className="h-4 w-4" />
              Create project
            </Link>
          }
        />
      )}
    </div>
  )
}
