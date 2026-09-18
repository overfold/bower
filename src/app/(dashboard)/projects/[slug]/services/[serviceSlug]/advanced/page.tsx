import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getProjectEnvironment, getServiceBySlug, getMergedServiceConfig, getUserOrganization } from '@/lib/queries'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { ServiceHeader } from '../service-header'
import { AdvancedConfigForm } from './advanced-config-form'

export default async function AdvancedPage({
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
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />

      <div className="space-y-2">
        <SectionTitle>Advanced execution</SectionTitle>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          Runtime isolation and workload API access for this service.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Execution"
          hint="Runtime and workload API access"
        />
        {mergedConfig ? (
          <AdvancedConfigForm
            key={environment.id}
            serviceId={service.id}
            environmentId={environment.id}
            runtime={mergedConfig.runtime}
            apiAccessScope={mergedConfig.apiAccessScope}
            apiAccessLevel={mergedConfig.apiAccessLevel}
          />
        ) : (
          <div className="p-4 text-[13px] text-ink-muted">No service configuration found.</div>
        )}
      </Panel>
    </div>
  )
}
