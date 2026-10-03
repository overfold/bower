import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getDeploymentsByService, getMergedServiceConfig, getProjectBySlug, getProjectEnvironment, getRoutesByProject, getServiceBySlug, getUserOrganization } from '@/lib/queries'
import { getProjectRole } from '@/lib/actions/shared'
import { ServiceHeader } from './service-header'
import { getProjectLiveServices } from '@/lib/service-health-query'
import { diffJobSpecs, diffServiceConfig } from '@/lib/service-config-diff'
import { getTrellisClient } from '@/lib/trellis-instance'
import type { TrellisReplacementBackoff } from '@/types/trellis'
import { ServiceShell } from './service-shell'
import { earlierSuccessfulReleases, runningRelease } from '@/lib/service-releases'
import { Suspense } from 'react'
import { ServiceHeaderSkeleton } from '@/components/page-skeletons'

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

  return <ServiceShell header={<Suspense fallback={<ServiceHeaderSkeleton />}><LiveServiceHeader
    slug={slug} serviceSlug={serviceSlug} orgId={org.org.id} service={service} environment={environment} canDeploy={role !== 'viewer'}
  /></Suspense>}>{children}</ServiceShell>
}

async function LiveServiceHeader({ slug, serviceSlug, orgId, service, environment, canDeploy }: {
  slug: string
  serviceSlug: string
  orgId: string
  service: NonNullable<Awaited<ReturnType<typeof getServiceBySlug>>>
  environment: NonNullable<Awaited<ReturnType<typeof getProjectEnvironment>>>
  canDeploy: boolean
}) {
  const [live, routes, deployments, savedConfig] = await Promise.all([
    getProjectLiveServices(orgId, service.projectId, environment),
    getRoutesByProject(service.projectId),
    getDeploymentsByService(service.id, 100),
    getMergedServiceConfig(service.id, environment.id),
  ])
  const row = live.services.find((entry) => entry.service.id === service.id)
  const config = row?.config
  const failingAllocation = row?.allocations.find((allocation) => allocation.phase === 'failed' || allocation.health === 'unhealthy') ?? row?.allocations[0]
  const route = routes.find((entry) => entry.route.environmentId === environment.id && entry.route.serviceId === service.id)
  const environmentDeployments = deployments.filter((deployment) => deployment.environmentId === environment.id)
  let runtimeJob = null
  const activeJobName = config?.activeJobName || service.slug
  if (config) {
    try { runtimeJob = await (await getTrellisClient(orgId)).getJob(activeJobName, environment.trellisNamespace) } catch { /* Runtime-dependent actions stay unavailable. */ }
  }
  const current = runningRelease(environmentDeployments, runtimeJob ? { name: activeJobName, version: runtimeJob.version, revision: runtimeJob.revision } : null)
  const changes = diffServiceConfig(savedConfig, runtimeJob?.spec ?? current?.jobSpec, current?.strategy)
  const rollbackTargets = earlierSuccessfulReleases(environmentDeployments, current)
  let replacementBackoff: TrellisReplacementBackoff | null = null
  if (config?.activeJobName && ['down', 'degraded'].includes(row?.health ?? '')) {
    try {
      const job = runtimeJob ?? await (await getTrellisClient(orgId)).getJob(config.activeJobName, environment.trellisNamespace)
      replacementBackoff = [...(job.replacement_backoff ?? [])].sort((a, b) => Date.parse(b.last_failure_at) - Date.parse(a.last_failure_at))[0] ?? null
    } catch { /* The status remains useful when runtime diagnostics are unavailable. */ }
  }

  return <ServiceHeader
      slug={slug} serviceSlug={serviceSlug} serviceName={service.name} serviceId={service.id}
      environmentId={environment.id} hasConfig={Boolean(config)} image={row?.latestDeployment ? row.latestDeployment.status === 'failed' ? row.latestDeployment.imageBefore : row.latestDeployment.imageAfter : config?.image ?? null}
      route={route?.route.domain ?? null}
      health={row?.health ?? 'never'} ready={row?.ready ?? null} replicas={config?.replicas ?? 0}
      canDeploy={canDeploy} failedDeploymentId={row?.latestDeployment?.status === 'failed' ? row.latestDeployment.id : undefined}
      changes={changes} rollbackTargets={rollbackTargets.map((deployment) => ({ id: deployment.id, image: deployment.imageAfter, createdAt: deployment.createdAt.toISOString(), changes: diffJobSpecs(deployment.jobSpec, runtimeJob?.spec ?? current?.jobSpec) }))}
      replacementBackoff={replacementBackoff}
      logsHref={failingAllocation ? `/projects/${slug}/services/${serviceSlug}/allocations/${failingAllocation.id}` : undefined}
    />
}
