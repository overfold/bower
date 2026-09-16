import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServiceBySlug, getServiceConfigsWithEnvironments, getDeploymentsByService, getEnvironmentsByProject, getMergedServiceConfig } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { Panel, PanelHeader, SectionTitle, KeyValue } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { StatusDot, Chip } from '@/components/status'
import { DeploymentPoller } from '@/components/deployment-poller'
import { ServiceActions } from './service-actions'
import { EditConfigDialog } from './edit-config-dialog'
import { ServiceHeader } from './service-header'
import { Box, Boxes, Rocket } from 'lucide-react'
import type { TrellisAllocation } from '@/types/trellis'

function OverrideBadge() {
  return (
    <Badge variant="info" className="ml-1.5 align-middle leading-none">override</Badge>
  )
}

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; serviceSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug, serviceSlug } = await params
  const { env: envParam } = await searchParams
  const environmentId = typeof envParam === 'string' ? envParam : null

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const [environments, configs, deployments] = await Promise.all([
    getEnvironmentsByProject(project.id),
    getServiceConfigsWithEnvironments(service.id),
    getDeploymentsByService(service.id, 10),
  ])

  const selectedEnv = environmentId ? environments.find((e) => e.id === environmentId) ?? null : null
  const mergedConfig = await getMergedServiceConfig(service.id, environmentId)

  const allocationRows: Array<{ allocation: TrellisAllocation; environmentName: string }> = []
  try {
    const client = await getTrellisClient(orgCtx.org.id)
    const relevantConfigs = selectedEnv
      ? configs.filter(({ environment }) => environment.id === selectedEnv.id)
      : configs
    const byEnvironment = await Promise.all(relevantConfigs.map(async ({ environment }) => {
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

  const overridden = new Set(mergedConfig?.overriddenFields ?? [])

  return (
    <div className="space-y-6">
      <DeploymentPoller active={hasActiveDeployment} />
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />

      <div className="space-y-4">
        {!mergedConfig && environmentId ? (
          <Panel>
            <EmptyState
              icon={<Box className="h-4 w-4" />}
              title="Environment not configured"
              body="No configuration found for this environment."
            />
          </Panel>
        ) : (
          <Panel>
            <PanelHeader
              title={selectedEnv ? selectedEnv.name : 'Base'}
              action={
                <div className="flex items-center gap-2">
                  {selectedEnv?.isLocked && (
                    <Chip tone="warn">Locked</Chip>
                  )}
                  <EditConfigDialog
                    serviceId={service.id}
                    environmentId={environmentId}
                    config={mergedConfig}
                    mode={environmentId ? 'env' : 'base'}
                    overriddenFields={mergedConfig?.overriddenFields ?? []}
                  />
                  {selectedEnv && mergedConfig && (
                    <ServiceActions
                      serviceId={service.id}
                      environmentId={selectedEnv.id}
                      isLocked={selectedEnv.isLocked}
                      replicas={mergedConfig.replicas}
                      canPromote={configs.length > 1}
                      promotionTargets={configs
                        .filter((c) => c.environment.id !== selectedEnv.id)
                        .map((c) => ({ id: c.environment.id, name: c.environment.name }))}
                      hasDeployments={deployments.some((d) => d.environmentId === selectedEnv.id)}
                    />
                  )}
                </div>
              }
            />
            {mergedConfig ? (
              <div className="p-4">
                <dl className="grid grid-cols-2 gap-x-8 gap-y-1 md:grid-cols-4">
                  <KeyValue label="Image" mono>
                    {mergedConfig.image}{overridden.has('image') && <OverrideBadge />}
                  </KeyValue>
                  <KeyValue label="Replicas">
                    {mergedConfig.replicas}{overridden.has('replicas') && <OverrideBadge />}
                  </KeyValue>
                  <KeyValue label="CPU">
                    {mergedConfig.cpu} mCPU{overridden.has('cpu') && <OverrideBadge />}
                  </KeyValue>
                  <KeyValue label="Memory">
                    {Math.round(mergedConfig.memory / 1024 / 1024)} MB{overridden.has('memory') && <OverrideBadge />}
                  </KeyValue>
                  {mergedConfig.port && (
                    <KeyValue label="Application port">
                      {mergedConfig.port}{overridden.has('port') && <OverrideBadge />}
                    </KeyValue>
                  )}
                  <KeyValue label="Strategy">
                    <span className="capitalize">{mergedConfig.deploymentStrategy.replace(/_/g, ' ')}</span>
                    {overridden.has('deploymentStrategy') && <OverrideBadge />}
                  </KeyValue>
                  {mergedConfig.healthCheckPath && (
                    <KeyValue label="Health check" mono>
                      {mergedConfig.healthCheckPath}{overridden.has('healthCheckPath') && <OverrideBadge />}
                    </KeyValue>
                  )}
                  {mergedConfig.command && (
                    <KeyValue label="Command" mono>
                      {mergedConfig.command}{overridden.has('command') && <OverrideBadge />}
                    </KeyValue>
                  )}
                  {mergedConfig.cronSchedule && (
                    <KeyValue label="Schedule" mono>
                      {mergedConfig.cronSchedule}{overridden.has('cronSchedule') && <OverrideBadge />}
                    </KeyValue>
                  )}
                </dl>
              </div>
            ) : (
              <div className="p-4 text-[13px] text-ink-muted">No configuration set yet.</div>
            )}
          </Panel>
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
