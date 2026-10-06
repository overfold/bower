import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectBySlug,
  getProjectEnvironment,
  getDeploymentsByProject,
  getRoutesByProject,
  getDeploymentFailureMessages,
  withFailureMessages,
} from '@/lib/queries'
import { Panel, PanelHeader, PanelFooter, SectionTitle } from '@/components/ui/panel'
import { StatusDot } from '@/components/status'
import { Chip } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Rocket, Globe, Server, ChevronRight } from 'lucide-react'
import { DeploymentPoller } from '@/components/deployment-poller'
import { Time } from '@/components/time'
import { tlsLabels } from '@/lib/labels'
import { getProjectLiveServices } from '@/lib/service-health-query'
import { CreateServiceDialog } from '@/components/create-service-dialog'
import { requireProject } from '@/lib/actions/shared'
import { Button } from '@/components/ui/button'
import { DeploymentsTable } from '@/components/deployments-table'
import { formatReadyReplicas } from '@/lib/format'
import { NeedsAttention } from '@/components/needs-attention'
import { latestFailedDeployments, needsAttentionRows } from '@/lib/needs-attention'

function imageTag(image: string | null): string {
  if (!image) return '-'
  const tag = image.split(':').pop() ?? image
  return tag.length > 20 ? tag.slice(0, 17) + '...' : tag
}

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const ctx = await getUserOrganization(user.id)
  if (!ctx) redirect('/no-organization')

  const { slug } = await params
  const project = await getProjectBySlug(ctx.org.id, slug)
  if (!project) redirect('/projects')

  const access = await requireProject(project.id)
  const [environment, allRoutes] = await Promise.all([
    getProjectEnvironment(project.id),
    getRoutesByProject(project.id),
  ])
  const [deployments, live] = await Promise.all([
    environment ? getDeploymentsByProject(project.id, null, environment.id) : [],
    getProjectLiveServices(ctx.org.id, project.id, environment),
  ])
  const services = live.services
  const routeRows = environment
    ? allRoutes.filter((row) => row.route.environmentId === environment.id)
    : []
  // eslint-disable-next-line react-hooks/purity
  const requestTime = Date.now()
  const failureMessages = await getDeploymentFailureMessages(latestFailedDeployments(deployments.map((row) => ({ ...row, projectSlug: slug })), requestTime).map((row) => row.deployment.id))
  const attentionRows = needsAttentionRows({ deployments: deployments.map((row) => ({ ...row, projectSlug: slug, failureMessage: failureMessages.get(row.deployment.id) })), allocations: services.flatMap((row) => row.allocations), jobs: live.jobs, targets: services.map(({ service, config }) => ({ serviceId: service.id, environmentId: environment?.id, namespace: environment?.trellisNamespace ?? '', job: config?.activeJobName ?? null, serviceName: service.name, serviceSlug: service.slug, projectSlug: slug })), now: requestTime })
  if (live.error) attentionRows.unshift({ id: 'runtime-error', status: 'unknown', serviceName: 'Service health', cause: 'Couldn’t check service health', href: '/status', action: 'Open status', severity: -1 })
  const recentDeployments = await withFailureMessages(deployments.slice(0, 5).map((row) => ({ ...row, projectName: project.name, projectSlug: project.slug })))
  const setupService = services.find(({ latestDeployment }) => latestDeployment?.status === 'healthy') ?? services[0]
  const deployed = services.some(({ latestDeployment }) => latestDeployment?.status === 'healthy')
  const settingUp = services.length === 0 || routeRows.length === 0

  return (
    <div className="space-y-5">
      <DeploymentPoller active={deployments.some((row) => ['pending', 'planning', 'deploying', 'rolling_back'].includes(row.deployment.status))} />
      <SectionTitle>Overview</SectionTitle>
      {settingUp ? <Panel>
        <PanelHeader title="Set up this project" />
        <ol className="divide-y divide-line text-sm">
          <li className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium text-ink">1. Create a service</p><p className="text-sm text-ink-muted">{setupService ? `${setupService.service.name} created.` : 'Define the workload you want to deploy.'}</p></div>{setupService ? <Chip tone="success">Done</Chip> : access.projectRole === 'admin' ? <CreateServiceDialog projectSlug={slug} /> : null}</li>
          <li className="flex items-center justify-between gap-4 p-4 text-ink-muted"><div><p className="font-medium">2. Deploy it</p><p className="text-sm">{deployed ? 'First deployment succeeded.' : setupService ? 'Deploy your service’s saved configuration.' : 'Available after you create a service.'}</p></div>{deployed ? <Chip tone="success">Done</Chip> : setupService && access.projectRole !== 'viewer' ? <Button asChild variant="primary"><Link href={`/projects/${slug}/services/${setupService.service.slug}?action=deploy`}>Deploy</Link></Button> : <Button disabled>Deploy</Button>}</li>
          <li className="flex items-center justify-between gap-4 p-4 text-ink-muted"><div><p className="font-medium">3. Add a route</p><p className="text-sm">{deployed ? 'Expose your service to traffic.' : 'Available after the first deployment.'}</p></div>{deployed && access.projectRole === 'admin' ? <Button asChild variant="primary"><Link href={`/projects/${slug}/routes`}>Add route</Link></Button> : <Button disabled>Add route</Button>}</li>
        </ol>
      </Panel> : null}
      <NeedsAttention rows={attentionRows} />
      {services.length > 0 && !settingUp ? <>
      <Panel>
        <PanelHeader title="Service health" hint={`${services.length} services`} />
        {services.length === 0 ? <EmptyState icon={<Server className="size-4" />} title="No services yet" body="Create a service to start deploying." action={access.projectRole === 'admin' ? <CreateServiceDialog projectSlug={slug} /> : undefined} /> :
          <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">{services.map(({ service, config, latestDeployment, health, ready }) => <Link key={service.id} href={`/projects/${slug}/services/${service.slug}`} className="p-4 transition-colors hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"><div className="flex items-center justify-between gap-2"><span className="text-tile font-medium text-ink">{service.name}</span><span className="flex items-center gap-2"><StatusDot status={health} /><ChevronRight className="size-4 text-ink-faint" aria-hidden="true" /></span></div><p className="mt-2 text-xs text-ink-muted">{formatReadyReplicas(ready, config?.replicas ?? 0)} · <span className="font-mono">{imageTag(config?.image ?? null)}</span></p><p className="mt-1 text-xs text-ink-muted">{latestDeployment ? <>Last deploy <Time value={latestDeployment.createdAt} /></> : 'Not deployed'}</p></Link>)}</div>}
        <PanelFooter shown={services.length} total={services.length} href={`/projects/${slug}/services`}>View all services</PanelFooter>
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Deployment history */}
        <Panel>
          <PanelHeader
            title="Recent deployments"
            hint={`${deployments.length} deployments`}
          />
          {deployments.length === 0 ? (
            <div className="px-4 py-6">
              <EmptyState
                icon={<Rocket className="h-4 w-4" />}
                title="No deployments yet"
                body="Deploy a service to see its history here."
                action={services.length ? <Button asChild variant="primary"><Link href={`/projects/${slug}/services`}>Deploy a service</Link></Button> : <div className="space-y-2"><Button disabled variant="primary">Deploy a service</Button><p className="text-xs text-ink-muted">Create a service first.</p></div>}
              />
            </div>
          ) : (
            <DeploymentsTable preset="compact" rows={recentDeployments} />
          )}
          <PanelFooter shown={Math.min(5, deployments.length)} total={deployments.length} href={`/projects/${slug}/deployments`}>View all deployments</PanelFooter>
        </Panel>

        {/* Routes */}
        <Panel>
          <PanelHeader title="Routes" hint={`${routeRows.length} routes`} />
          {routeRows.length === 0 ? (
            <div className="px-4 py-6">
              <EmptyState
                icon={<Globe className="h-4 w-4" />}
                title="No routes"
                body="Add a route to expose services to traffic."
                action={access.projectRole === 'admin' ? <Button asChild variant="primary"><Link href={`/projects/${slug}/routes`}>Add route</Link></Button> : undefined}
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {routeRows.slice(0, 4).map((row) => (
                  <li key={row.route.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-mono text-sm text-ink">
                        {row.route.domain}
                      </span>
                      {row.route.tlsMode !== 'auto' ? <Chip tone="neutral">{tlsLabels[row.route.tlsMode]}</Chip> : null}
                    </div>
                    <p className="mt-1 text-2xs text-ink-muted">
                      {row.route.pathPrefix} → {row.serviceName} · port {row.route.port}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
          <PanelFooter shown={Math.min(4, routeRows.length)} total={routeRows.length} href={`/projects/${slug}/routes`}>View all routes</PanelFooter>
        </Panel>
      </div>
      </> : null}
    </div>
  )
}
