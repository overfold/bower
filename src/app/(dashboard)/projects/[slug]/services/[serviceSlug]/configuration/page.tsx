import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment, getServiceBySlug, getMergedServiceConfig, getDeploymentsByService } from '@/lib/queries'
import { ServiceHeader } from '../service-header'
import { ServiceActions } from '../service-actions'
import { ConfigurationForm } from './configuration-form'
import { SectionTitle } from '@/components/ui/panel'

export default async function ServiceConfigurationPage({
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
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const environment = await getProjectEnvironment(project.id)
  if (!environment) notFound()
  const [mergedConfig, deployments] = await Promise.all([
    getMergedServiceConfig(service.id, environment.id),
    getDeploymentsByService(service.id, 20),
  ])
  const environmentDeployments = deployments.filter((deployment) => deployment.environmentId === environment.id)

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />
      {mergedConfig ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-muted">Deploy or restart this service after saving configuration changes.</p>
          <ServiceActions
            serviceId={service.id}
            environmentId={environment.id}
            hasDeployments={environmentDeployments.some((deployment) => Boolean(deployment.previousJobSpec))}
          />
        </div>
      ) : null}
      <div>
        <SectionTitle>Configuration</SectionTitle>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-muted">Configure the image, deployment behavior, resources, and health checks for this service.</p>
      </div>
      <ConfigurationForm
        serviceId={service.id}
        environmentId={environment.id}
        config={mergedConfig}
      />
    </div>
  )
}
