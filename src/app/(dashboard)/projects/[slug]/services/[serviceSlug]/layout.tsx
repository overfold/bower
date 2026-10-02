import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getProjectBySlug, getProjectEnvironment, getRoutesByProject, getServiceBySlug, getUserOrganization } from '@/lib/queries'
import { getProjectRole } from '@/lib/actions/shared'
import { ServiceHeader } from './service-header'
import { getProjectLiveServices } from '@/lib/service-health-query'

export default async function ServiceLayout({ children, params }: {
  children: React.ReactNode
  params: Promise<{ slug: string; serviceSlug: string }>
}) {
  const { slug, serviceSlug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const org = await getUserOrganization(user.id)
  if (!org) redirect('/login')
  const project = await getProjectBySlug(org.org.id, slug)
  if (!project) notFound()
  const role = await getProjectRole(user.id, org.role, project.id)
  if (!role) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()
  const environment = await getProjectEnvironment(project.id)
  if (!environment) notFound()
  const [live, routes] = await Promise.all([
    getProjectLiveServices(org.org.id, project.id, environment),
    getRoutesByProject(project.id),
  ])
  const row = live.services.find((entry) => entry.service.id === service.id)
  const config = row?.config
  const route = routes.find((entry) => entry.route.environmentId === environment.id && entry.route.serviceId === service.id)

  return <div className="space-y-6">
    <ServiceHeader
      slug={slug} serviceSlug={serviceSlug} serviceName={service.name} serviceId={service.id}
      environmentId={environment.id} hasConfig={Boolean(config)} image={row?.latestDeployment ? row.latestDeployment.status === 'failed' ? row.latestDeployment.imageBefore : row.latestDeployment.imageAfter : config?.image ?? null}
      route={route?.route.domain ?? null}
      health={row?.health ?? 'never'} ready={row?.ready ?? null} replicas={config?.replicas ?? 0}
      canDeploy={role !== 'viewer'} failedDeploymentId={row?.latestDeployment?.status === 'failed' ? row.latestDeployment.id : undefined}
    />
    {children}
  </div>
}
