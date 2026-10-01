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
import { StatusDot } from '@/components/status'
import { DeploymentPoller } from '@/components/deployment-poller'
import { ServiceHeader } from './service-header'
import { Boxes, Rocket } from 'lucide-react'
import type { TrellisAllocation } from '@/types/trellis'

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

  const hasActiveDeployment = selectedDeployments.some((d) =>
    ['pending', 'planning', 'deploying'].includes(d.status)
  )

  return (
    <div className="space-y-6">
      <DeploymentPoller active={hasActiveDeployment} />
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} serviceId={service.id} environmentId={environment.id} hasConfig={Boolean(selectedConfig)} />

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
                    <TableHead>Phase</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocationRows.map((allocation) => (
                    <TableRow key={allocation.id}>
                      <TableCell>
                        <Link href={`/projects/${slug}/services/${serviceSlug}/allocations/${allocation.id}`} className="font-mono text-xs font-medium text-ink transition-colors hover:text-brand-500">
                          {allocation.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusDot status={allocation.phase} />
                        {allocation.phase === 'pending' && <p className="mt-1 max-w-64 text-xs text-ink-muted">{allocation.message || allocation.reason || 'Awaiting placement'}</p>}
                      </TableCell>
                      <TableCell><StatusDot status={allocation.health} /></TableCell>
                      <TableCell><NodeLink id={allocation.node_id} /></TableCell>
                      <TableCell className="whitespace-nowrap text-ink-muted">{new Date(allocation.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDeployments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell><StatusDot status={d.status} /></TableCell>
                      <TableCell className="max-w-48 truncate font-mono text-xs">{d.imageAfter}</TableCell>
                      <TableCell className="capitalize">{d.strategy.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="capitalize">{d.triggerType.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-ink-muted">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
