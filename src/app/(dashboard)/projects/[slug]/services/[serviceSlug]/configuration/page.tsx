import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServiceBySlug, getMergedServiceConfig, getEnvironmentsByProject, getDeploymentsByService } from '@/lib/queries'
import { ServiceHeader } from '../service-header'
import { ServiceActions } from '../service-actions'
import { ConfigurationForm } from './configuration-form'

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

  const [environments, mergedConfig, deployments] = await Promise.all([
    getEnvironmentsByProject(project.id),
    getMergedServiceConfig(service.id, environmentId),
    getDeploymentsByService(service.id, 20),
  ])
  const selectedEnvironment = environmentId ? environments.find((environment) => environment.id === environmentId) : null
  if (environmentId && !selectedEnvironment) notFound()
  const environmentDeployments = environmentId ? deployments.filter((deployment) => deployment.environmentId === environmentId) : []

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />
      {selectedEnvironment && mergedConfig ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-muted">Actions apply to <span className="font-medium text-ink">{selectedEnvironment.name}</span>.</p>
          <ServiceActions
            serviceId={service.id}
            environmentId={selectedEnvironment.id}
            canPromote
            promotionTargets={environments.filter((environment) => environment.id !== selectedEnvironment.id).map((environment) => ({ id: environment.id, name: environment.name }))}
            hasDeployments={environmentDeployments.some((deployment) => Boolean(deployment.previousJobSpec))}
          />
        </div>
      ) : null}
      <ConfigurationForm
        serviceId={service.id}
        environmentId={environmentId}
        config={mergedConfig}
        overriddenFields={mergedConfig?.overriddenFields ?? []}
      />
    </div>
  )
}
