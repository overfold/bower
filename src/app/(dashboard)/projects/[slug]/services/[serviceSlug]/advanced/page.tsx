import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getServiceBySlug, getEnvironmentsByProject, getMergedServiceConfig, getUserOrganization } from '@/lib/queries'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { ServiceHeader } from '../service-header'
import { AdvancedConfigForm } from './advanced-config-form'

export default async function AdvancedPage({
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

  const environments = await getEnvironmentsByProject(project.id)
  const selectedEnv = environmentId ? environments.find((environment) => environment.id === environmentId) : null
  if (environmentId && !selectedEnv) notFound()

  const mergedConfig = await getMergedServiceConfig(service.id, environmentId)

  return (
    <div className="space-y-6">
      <ServiceHeader slug={slug} serviceSlug={serviceSlug} serviceName={service.name} />

      <div className="space-y-2">
        <SectionTitle>Advanced execution</SectionTitle>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          Runtime and workload API access for the scope selected above.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title={selectedEnv?.name ?? 'Base'}
          hint={selectedEnv ? 'Inherited values can be overridden here' : 'Defaults inherited by environments'}
        />
        {mergedConfig ? (
          <AdvancedConfigForm
            key={environmentId ?? 'base'}
            serviceId={service.id}
            environmentId={environmentId}
            runtime={mergedConfig.runtime}
            apiAccessScope={mergedConfig.apiAccessScope}
            apiAccessLevel={mergedConfig.apiAccessLevel}
            overriddenFields={mergedConfig.overriddenFields}
          />
        ) : (
          <div className="p-4 text-[13px] text-ink-muted">No service configuration found.</div>
        )}
      </Panel>
    </div>
  )
}
