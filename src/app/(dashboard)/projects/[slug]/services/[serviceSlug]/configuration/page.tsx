import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment, getServiceBySlug, getMergedServiceConfig, getSecretsByProject } from '@/lib/queries'
import { ConfigurationForm } from './configuration-form'
import { SectionTitle } from '@/components/ui/panel'
import { getTrellisJobLimits } from '@/lib/trellis-instance'
import { requireProject } from '@/lib/actions/shared'
import { instanceAdminMayBypassMultitenancy } from '@/lib/workload-policy'

function values(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, String(entry)]))
}

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
  const access = await requireProject(project.id)

  const environment = await getProjectEnvironment(project.id)
  if (!environment) notFound()
  const [mergedConfig, limits, secrets] = await Promise.all([
    getMergedServiceConfig(service.id, environment.id),
    getTrellisJobLimits(orgCtx.org.id),
    getSecretsByProject(project.id),
  ])

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Configuration</SectionTitle>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">Configure the image, deployment behavior, resources, and health checks for this service.</p>
      </div>
      <ConfigurationForm
        serviceId={service.id}
        environmentId={environment.id}
        config={mergedConfig}
        limits={limits}
        projectId={project.id}
        serviceName={service.name}
        sharedNames={Object.keys(values(environment.envVars))}
        secretLabels={Object.fromEntries(secrets.filter((row) => row.secret.environmentId === environment.id).map((row) => [row.secret.trellisSecretName, row.secret.name]))}
        canManage={access.projectRole === 'admin'}
        mayBypassMultitenancy={instanceAdminMayBypassMultitenancy(user.isInstanceAdmin)}
        environmentUpdatedAt={environment.updatedAt.toISOString()}
      />
    </div>
  )
}
