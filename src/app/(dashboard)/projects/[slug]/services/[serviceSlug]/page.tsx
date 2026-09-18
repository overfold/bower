import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServiceBySlug, getServiceConfigsWithEnvironments, getDeploymentsByService, getEnvironmentsByProject } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { Panel, SectionTitle } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusDot } from '@/components/status'
import { DeploymentPoller } from '@/components/deployment-poller'
import { ServiceHeader } from './service-header'
import { ServiceActions } from './service-actions'
import { Boxes, Rocket } from 'lucide-react'
import type { TrellisAllocation } from '@/types/trellis'

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; serviceSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug, serviceSlug } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const { env } = await searchParams
  const environmentId = typeof env === 'string' ? env : null
  const [configs, deployments, environments] = await Promise.all([
    getServiceConfigsWithEnvironments(service.id),
    getDeploymentsByService(service.id, 10),
    getEnvironmentsByProject(project.id),
  ])
  const selectedEnvironment = environmentId ? environments.find((environment) => environment.id === environmentId) : null
  if (environmentId && !selectedEnvironment) notFound()
  const selectedConfigs = environmentId ? configs.filter(({ environment }) => environment.id === environmentId) : []
  const selectedDeployments = environmentId ? deployments.filter((deployment) => deployment.environmentId === environmentId) : []

  const allocationRows: Array<{ allocation: TrellisAllocation; environmentName: string }> = []
  try {
    const client = await getTrellisClient(orgCtx.org.id)
    const byEnvironment = await Promise.all(selectedConfigs.map(async ({ environment }) => {
      const allocations = await client.listAllocations({ namespace: environment.trellisNamespace }).catch(() => [])
      return allocations
        .filter((allocation) => allocation.phase !== 'stopped' && allocation.labels?.['bower/service'] === service.slug)
        .map((allocation) => ({ allocation, environmentName: environment.name }))
    }))
    allocationRows.push(...byEnvironment.flat())
  } catch {
    // Runtime visibility is best-effort; service configuration remains usable if Trellis is temporarily unreachable.
  }
  allocationRows.sort((a, b) => Date.parse(b.allocation.created_at) - Date.parse(a.allocation.created_at))

  const hasActiveDeployment = selectedDeployments.some((d) =>
    ['pending', 'planning', 'deploying'].includes(d.status)
  )

  return (
    <div className="space-y-6">
      <DeploymentPoller active={hasActiveDeployment} />
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />
      {selectedEnvironment && selectedConfigs[0] ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-muted">Runtime for <span className="font-medium text-ink">{selectedEnvironment.name}</span>.</p>
          <ServiceActions serviceId={service.id} environmentId={selectedEnvironment.id} canPromote promotionTargets={environments.filter((environment) => environment.id !== selectedEnvironment.id).map((environment) => ({ id: environment.id, name: environment.name }))} hasDeployments={selectedDeployments.some((deployment) => Boolean(deployment.previousJobSpec))} />
        </div>
      ) : null}

      <div className="space-y-5">
        <SectionTitle>Current allocations</SectionTitle>
        {allocationRows.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Boxes className="h-4 w-4" />}
              title="No current allocations"
              body={selectedEnvironment ? 'Deploy this service to see its runtime allocations and diagnostics.' : 'Select an environment to view runtime allocations.'}
            />
          </Panel>
        ) : (
          <Panel>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Allocation</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocationRows.map(({ allocation, environmentName }) => (
                    <TableRow key={allocation.id}>
                      <TableCell>
                        <Link href={`/projects/${slug}/services/${serviceSlug}/allocations/${allocation.id}?env=${encodeURIComponent(environmentId!)}`} className="font-mono text-xs font-medium text-ink transition-colors hover:text-brand-500">
                          {allocation.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{environmentName}</TableCell>
                      <TableCell><StatusDot status={allocation.phase} /></TableCell>
                      <TableCell><StatusDot status={allocation.health} /></TableCell>
                      <TableCell className="max-w-40 truncate font-mono text-xs text-ink-muted">{allocation.node_id}</TableCell>
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
              body={selectedEnvironment ? 'Deploy this service to see its history here.' : 'Select an environment to view deployment history.'}
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
