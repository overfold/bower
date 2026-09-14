import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServiceBySlug, getServiceConfigsWithEnvironments, getDeploymentsByService } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { Panel, PanelHeader, SectionTitle, KeyValue } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusDot, Chip } from '@/components/status'
import { DeploymentPoller } from '@/components/deployment-poller'
import { ServiceActions } from './service-actions'
import { EditConfigDialog } from './edit-config-dialog'
import { ServiceHeader } from './service-header'
import { Box, Boxes, Rocket } from 'lucide-react'
import type { TrellisAllocation } from '@/types/trellis'

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string; serviceSlug: string }> }) {
  const { slug, serviceSlug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const [configs, deployments] = await Promise.all([
    getServiceConfigsWithEnvironments(service.id),
    getDeploymentsByService(service.id, 10),
  ])

  const allocationRows: Array<{ allocation: TrellisAllocation; environmentName: string }> = []
  try {
    const client = await getTrellisClient(orgCtx.org.id)
    const byEnvironment = await Promise.all(configs.map(async ({ environment }) => {
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

  const hasActiveDeployment = deployments.some((d) =>
    ['pending', 'planning', 'deploying'].includes(d.status)
  )

  return (
    <div className="space-y-6">
      <DeploymentPoller active={hasActiveDeployment} />
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />

      <div className="space-y-4">
        {configs.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Box className="h-4 w-4" />}
              title="No configurations"
              body="No environment configurations found."
            />
          </Panel>
        ) : (
          configs.map(({ config, environment }) => (
            <Panel key={config.id}>
              <PanelHeader
                title={environment.name}
                action={
                  <div className="flex items-center gap-2">
                    {environment.isLocked && (
                      <Chip tone="warn">Locked</Chip>
                    )}
                    <EditConfigDialog
                      serviceId={service.id}
                      environmentId={environment.id}
                      config={config}
                    />
                    <ServiceActions
                      serviceId={service.id}
                      environmentId={environment.id}
                      isLocked={environment.isLocked}
                      replicas={config.replicas}
                      canPromote={configs.length > 1}
                      promotionTargets={configs
                        .filter((c) => c.environment.id !== environment.id)
                        .map((c) => ({ id: c.environment.id, name: c.environment.name }))}
                      hasDeployments={deployments.some((d) => d.environmentId === environment.id)}
                    />
                  </div>
                }
              />
              <div className="p-4">
                <dl className="grid grid-cols-2 gap-x-8 gap-y-1 md:grid-cols-4">
                  <KeyValue label="Image" mono>{config.image}</KeyValue>
                  <KeyValue label="Replicas">{config.replicas}</KeyValue>
                  <KeyValue label="CPU">{config.cpu} mCPU</KeyValue>
                  <KeyValue label="Memory">{Math.round(config.memory / 1024 / 1024)} MB</KeyValue>
                  {config.port && <KeyValue label="Application port">{config.port}</KeyValue>}
                  <KeyValue label="Strategy">
                    <span className="capitalize">{config.deploymentStrategy.replace(/_/g, ' ')}</span>
                  </KeyValue>
                  <KeyValue label="Tier">
                    <span className="capitalize">{config.resourceTier}</span>
                  </KeyValue>
                  {config.healthCheckPath && (
                    <KeyValue label="Health check" mono>{config.healthCheckPath}</KeyValue>
                  )}
                  {config.command && (
                    <KeyValue label="Command" mono>{config.command}</KeyValue>
                  )}
                  {config.cronSchedule && (
                    <KeyValue label="Schedule" mono>{config.cronSchedule}</KeyValue>
                  )}
                </dl>
              </div>
            </Panel>
          ))
        )}
      </div>

      <div className="space-y-5">
        <SectionTitle>Current allocations</SectionTitle>
        {allocationRows.length === 0 ? (
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
                        <Link href={`/projects/${slug}/services/${serviceSlug}/allocations/${allocation.id}`} className="font-mono text-xs font-medium text-ink transition-colors hover:text-brand-500">
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
        {deployments.length === 0 ? (
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
                  {deployments.map((d) => (
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
