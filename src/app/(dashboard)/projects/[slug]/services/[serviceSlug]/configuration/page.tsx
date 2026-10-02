import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment, getServiceBySlug, getMergedServiceConfig } from '@/lib/queries'
import { ServiceHeader } from '../service-header'
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
  const mergedConfig = await getMergedServiceConfig(service.id, environment.id)

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} serviceId={service.id} environmentId={environment.id} hasConfig={Boolean(mergedConfig)} />
      <div>
        <SectionTitle>Configuration</SectionTitle>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">Configure the image, deployment behavior, resources, and health checks for this service.</p>
      </div>
      <ConfigurationForm
        serviceId={service.id}
        environmentId={environment.id}
        config={mergedConfig}
      />
    </div>
  )
}
