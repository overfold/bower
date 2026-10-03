import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment, getServiceBySlug, getServiceConfigsWithEnvironments, getDeploymentsByService } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { allocationBelongsToService, trellisReadError } from '@/lib/trellis-runtime'
import { TrellisReadError } from '@/components/trellis-read-error'
import { NodeLink } from '@/components/node-link'
import { getProjectRole } from '@/lib/actions/shared'
import { Panel, SectionTitle } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { AllocationStatus } from '@/components/status'
import { DeploymentPoller } from '@/components/deployment-poller'
import { Boxes, ChevronRight, Rocket } from 'lucide-react'
import type { TrellisAllocation } from '@/types/trellis'
import { Time } from '@/components/time'
import { ResourceId } from '@/components/resource-id'
import { formatCpu, formatMemory } from '@/lib/format'
import { DeploymentsTable } from '@/components/deployments-table'
import { ClickableTableRow } from '@/components/clickable-table-row'

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string; serviceSlug: string }>
}) {
  const { slug, serviceSlug } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  if (!await getProjectRole(user.id, orgCtx.role, project.id)) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const [configs, deployments, environment] = await Promise.all([
    getServiceConfigsWithEnvironments(service.id),
    getDeploymentsByService(service.id, 10),
    getProjectEnvironment(project.id),
  ])
  if (!environment) notFound()
  const selectedConfig = configs.find((row) => row.environment.id === environment.id)
  const selectedDeployments = deployments.filter((deployment) => deployment.environmentId === environment.id)

  const allocationRows: TrellisAllocation[] = []
  let allocationError: string | null = null
  try {
    const client = await getTrellisClient(orgCtx.org.id)
    if (selectedConfig) {
      const allocations = await client.listAllocations({ namespace: environment.trellisNamespace })
      allocationRows.push(...allocations.filter((allocation) => allocation.phase !== 'stopped'
        && allocationBelongsToService(allocation, environment.trellisNamespace, service.slug, [service.slug, selectedConfig.config.activeJobName])))
    }
  } catch (error) {
    allocationError = trellisReadError(error)
  }
  allocationRows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const metrics = allocationError ? [] : await Promise.allSettled(allocationRows.map((allocation) => getTrellisClient(orgCtx.org.id).then((client) => client.getAllocationMetrics(allocation.id, allocation.namespace))))
  const memoryUsed = metrics.reduce((total, result) => total + (result.status === 'fulfilled' ? result.value.reduce((sum, sample) => sum + Math.max(0, sample.memory_usage_bytes), 0) : 0), 0)
  const cpuLimit = (selectedConfig?.config.cpu ?? 0) * (selectedConfig?.config.replicas ?? 0)
  const memoryLimit = (selectedConfig?.config.memory ?? 0) * (selectedConfig?.config.replicas ?? 0)
  const ready = allocationRows.filter((allocation) => allocation.phase === 'running' && allocation.health === 'healthy').length
  const cpuAllocated = (selectedConfig?.config.cpu ?? 0) * ready

  const hasActiveDeployment = selectedDeployments.some((d) =>
    ['pending', 'planning', 'deploying'].includes(d.status)
  )

  return (
    <div className="space-y-6">
      <DeploymentPoller active={hasActiveDeployment} />

      <div className="grid gap-4 sm:grid-cols-2" aria-label="Service resource usage">
        <Panel className="p-4"><p className="text-xs font-medium text-ink-muted">CPU allocation</p><p className="nums mt-1.5 text-2xl font-semibold text-ink">{formatCpu(cpuAllocated)} / {formatCpu(cpuLimit)}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-brand-500" style={{ width: `${cpuLimit ? Math.min(100, cpuAllocated / cpuLimit * 100) : 0}%` }} /></div></Panel>
        <Panel className="p-4"><p className="text-xs font-medium text-ink-muted">Memory usage</p><p className="nums mt-1.5 text-2xl font-semibold text-ink">{formatMemory(memoryUsed)} / {formatMemory(memoryLimit)}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-brand-500" style={{ width: `${memoryLimit ? Math.min(100, memoryUsed / memoryLimit * 100) : 0}%` }} /></div></Panel>
      </div>

      <div className="space-y-5">
        <SectionTitle>Current allocations</SectionTitle>
        {allocationError ? <Panel><TrellisReadError title="Allocations unavailable" message={allocationError} /></Panel> : allocationRows.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Boxes className="h-4 w-4" />}
              title="No current allocations"
              body="Deploy this service to see its runtime allocations and diagnostics."
            />
          </Panel>
        ) : (
          <Panel>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Allocation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                    <TableHead className="w-12"><span className="sr-only">View</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocationRows.map((allocation) => {
                    const href = `/projects/${slug}/services/${serviceSlug}/allocations/${allocation.id}`
                    return <ClickableTableRow key={allocation.id} href={href} label={`View allocation ${allocation.id}`}>
                      <TableCell>
                        <Link href={href} className="font-mono text-xs font-medium text-link">
                          <ResourceId value={allocation.id} />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <AllocationStatus phase={allocation.phase} health={allocation.health} />
                        {allocation.phase === 'pending' && <p className="mt-1 max-w-64 text-xs text-ink-muted">{allocation.message || allocation.reason || 'Awaiting placement'}</p>}
                      </TableCell>
                      <TableCell><NodeLink id={allocation.node_id} /></TableCell>
                      <TableCell className="whitespace-nowrap text-right text-ink-muted"><Time value={allocation.created_at} /></TableCell>
                      <TableCell><ChevronRight className="ml-auto h-4 w-4 text-ink-muted" aria-hidden="true" /></TableCell>
                    </ClickableTableRow>
                  })}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )}
      </div>

      <div className="space-y-5">
        <SectionTitle>Recent deployments</SectionTitle>
        {selectedDeployments.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Rocket className="h-4 w-4" />}
              title="No deployments yet"
              body="Deploy this service to see its history here."
            />
          </Panel>
        ) : (
          <Panel>
            <div className="overflow-x-auto">
              <DeploymentsTable preset="project" rows={selectedDeployments.map((deployment) => ({ deployment, serviceName: service.name, serviceSlug: service.slug, projectName: project.name, projectSlug: project.slug }))} />
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
