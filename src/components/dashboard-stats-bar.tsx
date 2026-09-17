import { Panel } from '@/components/ui/panel'
import type { TrellisAllocation, TrellisNode } from '@/types/trellis'

type DeploymentStatus =
  | 'pending'
  | 'planning'
  | 'deploying'
  | 'healthy'
  | 'failed'
  | 'rolled_back'

interface DeploymentPoint {
  createdAt: Date
  status: DeploymentStatus
}

interface DashboardStatsBarProps {
  nodes: TrellisNode[]
  allocations: TrellisAllocation[]
  deployments: DeploymentPoint[]
  clusterAvailable: boolean
}

interface DeploymentDay {
  key: string
  label: string
  total: number
  healthy: number
  failed: number
  active: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatCpu(millicores: number) {
  if (millicores >= 1000) return `${(millicores / 1000).toFixed(1)}`
  return `${(millicores / 1000).toFixed(2)}`
}

function formatMemGiB(bytes: number) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(1)
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function deploymentSeries(deployments: DeploymentPoint[], days = 14): DeploymentDay[] {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const start = new Date(today.getTime() - (days - 1) * DAY_MS)

  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS)
    return {
      key: dateKey(date),
      label: `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`,
      total: 0,
      healthy: 0,
      failed: 0,
      active: 0,
    }
  })

  const byKey = new Map(series.map((day) => [day.key, day]))
  for (const deployment of deployments) {
    const day = byKey.get(dateKey(deployment.createdAt))
    if (!day) continue

    day.total += 1
    if (deployment.status === 'healthy') day.healthy += 1
    else if (deployment.status === 'failed' || deployment.status === 'rolled_back') day.failed += 1
    else day.active += 1
  }

  return series
}

function StatCell({
  label,
  value,
  detail,
  meter,
}: {
  label: string
  value: React.ReactNode
  detail: React.ReactNode
  meter?: number
}) {
  return (
    <section className="min-w-0 bg-surface px-4 py-4 sm:px-5">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="nums text-2xl font-semibold tracking-tight text-ink">{value}</p>
        {meter !== undefined ? (
          <div className="mb-1 h-1.5 w-14 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.min(100, Math.max(0, meter))}%` }}
            />
          </div>
        ) : null}
      </div>
      <p className="mt-1.5 truncate text-xs text-ink-muted">{detail}</p>
    </section>
  )
}

export function DashboardStatsBar({
  nodes,
  allocations,
  deployments,
  clusterAvailable,
}: DashboardStatsBarProps) {
  const liveAllocations = allocations.filter((allocation) =>
    allocation.phase === 'placed' ||
    allocation.phase === 'starting' ||
    allocation.phase === 'running' ||
    allocation.phase === 'stopping'
  )
  const healthyAllocations = liveAllocations.filter(
    (allocation) => allocation.phase === 'running' && allocation.health === 'healthy'
  ).length
  const unhealthyAllocations = liveAllocations.filter(
    (allocation) => allocation.health === 'unhealthy'
  ).length
  const transitioningAllocations = Math.max(
    0,
    liveAllocations.length - healthyAllocations - unhealthyAllocations
  )

  const totalCpu = nodes.reduce((sum, node) => sum + node.cpu, 0)
  const allocatedCpu = nodes.reduce((sum, node) => sum + (node.cpu_used ?? 0), 0)
  const totalMemory = nodes.reduce((sum, node) => sum + node.memory, 0)
  const allocatedMemory = nodes.reduce((sum, node) => sum + (node.memory_used ?? 0), 0)
  const cpuPct = totalCpu > 0 ? Math.round((allocatedCpu / totalCpu) * 100) : 0
  const memoryPct = totalMemory > 0 ? Math.round((allocatedMemory / totalMemory) * 100) : 0

  const series = deploymentSeries(deployments)
  const deploymentCount = series.reduce((sum, day) => sum + day.total, 0)
  const completedCount = series.reduce((sum, day) => sum + day.healthy + day.failed, 0)
  const successfulCount = series.reduce((sum, day) => sum + day.healthy, 0)
  const successRate = completedCount > 0 ? Math.round((successfulCount / completedCount) * 100) : null
  const maxDailyDeployments = Math.max(1, ...series.map((day) => day.total))

  const allocationDetail = !clusterAvailable
    ? 'Cluster unavailable'
    : liveAllocations.length === 0
      ? 'No active allocations'
      : unhealthyAllocations > 0
        ? `${unhealthyAllocations} unhealthy${transitioningAllocations > 0 ? ` · ${transitioningAllocations} transitioning` : ''}`
        : transitioningAllocations > 0
          ? `${transitioningAllocations} transitioning`
          : 'All active allocations healthy'

  return (
    <Panel className="overflow-hidden">
      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(300px,1.7fr)]">
        <StatCell
          label="Allocation health"
          value={clusterAvailable ? `${healthyAllocations}/${liveAllocations.length}` : '—'}
          detail={allocationDetail}
        />
        <StatCell
          label="CPU allocated"
          value={clusterAvailable ? `${cpuPct}%` : '—'}
          detail={clusterAvailable ? `${formatCpu(allocatedCpu)} / ${formatCpu(totalCpu)} cores` : 'Cluster unavailable'}
          meter={clusterAvailable ? cpuPct : undefined}
        />
        <StatCell
          label="Memory allocated"
          value={clusterAvailable ? `${memoryPct}%` : '—'}
          detail={clusterAvailable ? `${formatMemGiB(allocatedMemory)} / ${formatMemGiB(totalMemory)} GiB` : 'Cluster unavailable'}
          meter={clusterAvailable ? memoryPct : undefined}
        />

        <section className="min-w-0 bg-surface px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-muted">Deployments · 14 days</p>
              <div className="mt-2 flex items-baseline gap-2.5">
                <p className="nums text-2xl font-semibold tracking-tight text-ink">{deploymentCount}</p>
                <p className="text-xs text-ink-muted">
                  {successRate === null ? 'No completed deployments' : `${successRate}% successful`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 pt-0.5 text-2xs text-ink-muted" aria-hidden="true">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />healthy</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-danger-500" />failed</span>
            </div>
          </div>

          <div
            className="mt-3 flex h-12 items-end gap-1"
            role="img"
            aria-label={`Deployment activity over the last 14 days: ${deploymentCount} deployments${successRate === null ? '' : `, ${successRate}% successful`}.`}
          >
            {series.map((day) => {
              const height = day.total === 0 ? 4 : Math.max(10, (day.total / maxDailyDeployments) * 100)
              return (
                <div
                  key={day.key}
                  className="flex h-full min-w-0 flex-1 items-end"
                  title={`${day.label}: ${day.total} total, ${day.healthy} healthy, ${day.failed} failed/rolled back${day.active ? `, ${day.active} in flight` : ''}`}
                >
                  <div
                    className="flex w-full flex-col-reverse overflow-hidden rounded-[2px] bg-line"
                    style={{ height: `${height}%` }}
                  >
                    {day.healthy > 0 ? <span className="min-h-px bg-brand-500" style={{ flexGrow: day.healthy }} /> : null}
                    {day.failed > 0 ? <span className="min-h-px bg-danger-500" style={{ flexGrow: day.failed }} /> : null}
                    {day.active > 0 ? <span className="min-h-px bg-warn-400" style={{ flexGrow: day.active }} /> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </Panel>
  )
}
