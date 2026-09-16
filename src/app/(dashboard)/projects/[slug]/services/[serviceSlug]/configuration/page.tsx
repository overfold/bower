import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServiceBySlug, getServiceConfigsWithEnvironments, getDeploymentsByService, getEnvironmentsByProject, getMergedServiceConfig } from '@/lib/queries'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Chip } from '@/components/status'
import { ServiceActions } from '../service-actions'
import { EditConfigDialog } from '../edit-config-dialog'
import { Box } from 'lucide-react'

function OverrideBadge() {
  return (
    <Badge variant="info" className="ml-1.5 align-middle leading-none">override</Badge>
  )
}

export default async function ServiceConfigurationPage({
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
  const overridden = new Set(mergedConfig?.overriddenFields ?? [])

  return (
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
                {selectedEnv?.isLocked && <Chip tone="warn">Locked</Chip>}
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
  )
}
