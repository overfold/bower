import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServiceBySlug, getMergedServiceConfig } from '@/lib/queries'
import { ServiceHeader } from '../service-header'
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

  const mergedConfig = await getMergedServiceConfig(service.id, environmentId)

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />
      <ConfigurationForm
        serviceId={service.id}
        environmentId={environmentId}
        config={mergedConfig}
        overriddenFields={mergedConfig?.overriddenFields ?? []}
      />
    </div>
  )
}
