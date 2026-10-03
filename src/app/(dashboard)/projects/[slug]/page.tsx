import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectBySlug,
  getProjectEnvironment,
  getDeploymentsByProject,
  getRoutesByProject,
} from '@/lib/queries'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { StatusDot } from '@/components/status'
import { Chip } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Rocket, Globe, Server } from 'lucide-react'
import { Time } from '@/components/time'
import { tlsLabels } from '@/lib/labels'
import { getProjectLiveServices } from '@/lib/service-health-query'
import { LastDeployFailed } from '@/components/last-deploy-failed'
import { CreateServiceDialog } from '@/components/create-service-dialog'
import { requireProject } from '@/lib/actions/shared'
import { Button } from '@/components/ui/button'
import { DeploymentsTable } from '@/components/deployments-table'
import { formatReadyReplicas } from '@/lib/format'

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
  if (!ctx) redirect('/login')

  const { slug } = await params
  const project = await getProjectBySlug(ctx.org.id, slug)
  if (!project) redirect('/projects')

  const access = await requireProject(project.id)
  const [environment, allRoutes] = await Promise.all([
    getProjectEnvironment(project.id),
    getRoutesByProject(project.id),
  ])
  const [deployments, live] = await Promise.all([
    environment ? getDeploymentsByProject(project.id, 5, environment.id) : [],
    getProjectLiveServices(ctx.org.id, project.id, environment),
  ])
  const services = live.services
  const routeRows = environment
    ? allRoutes.filter((row) => row.route.environmentId === environment.id)
    : []
  const attention = services.filter(({ health, latestDeployment }) => ['down', 'degraded', 'unhealthy'].includes(health) || latestDeployment?.status === 'failed')
  const setupService = services.find(({ latestDeployment }) => latestDeployment?.status === 'healthy') ?? services[0]
  const deployed = services.some(({ latestDeployment }) => latestDeployment?.status === 'healthy')
  const settingUp = services.length === 0 || routeRows.length === 0

  return (
    <div className="space-y-5">
      <SectionTitle>Overview</SectionTitle>
      {settingUp ? <Panel>
        <PanelHeader title="Set up this project" />
        <ol className="divide-y divide-line text-sm">
          <li className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium text-ink">1. Create a service</p><p className="text-sm text-ink-muted">{setupService ? `${setupService.service.name} created.` : 'Define the workload you want to deploy.'}</p></div>{setupService ? <Chip tone="success">Done</Chip> : access.projectRole === 'admin' ? <CreateServiceDialog projectSlug={slug} /> : null}</li>
          <li className="flex items-center justify-between gap-4 p-4 text-ink-muted"><div><p className="font-medium">2. Deploy it</p><p className="text-sm">{deployed ? 'First deployment succeeded.' : setupService ? 'Deploy your service’s saved configuration.' : 'Available after you create a service.'}</p></div>{deployed ? <Chip tone="success">Done</Chip> : setupService && access.projectRole !== 'viewer' ? <Button asChild variant="primary"><Link href={`/projects/${slug}/services/${setupService.service.slug}?action=deploy`}>Deploy</Link></Button> : <Button disabled>Deploy</Button>}</li>
          <li className="flex items-center justify-between gap-4 p-4 text-ink-muted"><div><p className="font-medium">3. Add a route</p><p className="text-sm">{deployed ? 'Expose your service to traffic.' : 'Available after the first deployment.'}</p></div>{deployed && access.projectRole === 'admin' ? <Button asChild variant="primary"><Link href={`/projects/${slug}/routes`}>Add route</Link></Button> : <Button disabled>Add route</Button>}</li>
        </ol>
      </Panel> : null}
      {attention.length ? <Panel><PanelHeader title="Needs attention" />
        <ul className="divide-y divide-line">{attention.map(({ service, latestDeployment, health }) => <li key={service.id} className="flex items-center gap-4 px-4 py-3"><Chip tone="danger">{latestDeployment?.status === 'failed' ? 'Failed' : 'Unhealthy'}</Chip><div className="min-w-0 flex-1"><Link className="font-medium text-link" href={`/projects/${slug}/services/${service.slug}`}>{service.name}</Link><p className="text-xs text-ink-muted">{latestDeployment?.status === 'failed' ? 'The latest deployment failed.' : 'One or more health checks are failing.'}</p></div>{latestDeployment?.status === 'failed' ? <LastDeployFailed href={`/projects/${slug}/deployments/${latestDeployment.id}`} /> : <StatusDot status={health} />}</li>)}</ul>
      </Panel> : null}
      {services.length > 0 && !settingUp ? <>
      <Panel>
        <PanelHeader title="Service health" action={services.length ? <Link href={`/projects/${slug}/services`} className="text-link text-sm font-medium">View all</Link> : undefined} />
        {services.length === 0 ? <EmptyState icon={<Server className="size-4" />} title="No services yet" body="Create a service to start deploying." action={access.projectRole === 'admin' ? <CreateServiceDialog projectSlug={slug} /> : undefined} /> :
          <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">{services.map(({ service, config, latestDeployment, health, ready }) => <Link key={service.id} href={`/projects/${slug}/services/${service.slug}`} className="p-4 hover:bg-sunken"><div className="flex items-center justify-between gap-2"><span className="font-medium text-ink">{service.name}</span><StatusDot status={health} /></div><p className="mt-2 text-xs text-ink-muted">{formatReadyReplicas(ready, config?.replicas ?? 0)} · <span className="font-mono">{imageTag(config?.image ?? null)}</span></p><p className="mt-1 text-xs text-ink-muted">{latestDeployment ? <>Last deploy <Time value={latestDeployment.createdAt} /></> : 'Not deployed'}</p></Link>)}</div>}
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Deployment history */}
        <Panel>
          <PanelHeader
            title="Recent deployments"
            action={deployments.length > 0 ?
              <Link
                href={`/projects/${slug}/deployments`}
                className="text-link text-sm font-medium"
              >
                View all
              </Link>
            : undefined}
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
            <DeploymentsTable preset="project" rows={deployments.map((row) => ({ ...row, projectName: project.name, projectSlug: project.slug }))} />
          )}
        </Panel>

        {/* Routes */}
        <Panel>
          <PanelHeader title="Routes" action={routeRows.length ? <Link href={`/projects/${slug}/routes`} className="text-link text-sm font-medium">View all</Link> : undefined} />
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
                      <span className="text-sm text-ink-muted">{tlsLabels[row.route.tlsMode]}</span>
                    </div>
                    <p className="mt-1 text-2xs text-ink-muted">
                      {row.route.pathPrefix} → {row.serviceName}:{row.route.port}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
      </> : null}
    </div>
  )
}
