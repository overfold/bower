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
import { StatusDot, DeploymentStatus } from '@/components/status'
import { EmptyState } from '@/components/ui/empty-state'
import { Rocket, Globe, Server } from 'lucide-react'
import { Time } from '@/components/time'
import { tlsLabels } from '@/lib/labels'
import { getProjectLiveServices } from '@/lib/service-health-query'
import { LastDeployFailed } from '@/components/last-deploy-failed'
import { CreateServiceDialog } from '@/components/create-service-dialog'
import { requireProject } from '@/lib/actions/shared'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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

  return (
    <div className="space-y-5">
      <div><SectionTitle>Overview</SectionTitle><p className="mt-1 text-sm text-ink-muted">See this project’s services, recent deployments, and routes.</p></div>
      <Panel>
        <PanelHeader title="Services" />
        {services.length === 0 ? <EmptyState icon={<Server className="size-4" />} title="No services yet" body="Create a service to start deploying." action={access.projectRole === 'admin' ? <CreateServiceDialog projectSlug={slug} /> : undefined} /> :
          <Table><TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Status</TableHead><TableHead>Ready</TableHead><TableHead>Image tag</TableHead><TableHead className="text-right">Last deploy</TableHead></TableRow></TableHeader><TableBody>
            {services.map(({ service, config, latestDeployment, health, ready }) => <TableRow key={service.id}>
              <TableCell><Link className="text-link font-medium" href={`/projects/${slug}/services/${service.slug}`}>{service.name}</Link></TableCell>
              <TableCell><div className="flex items-center gap-2"><StatusDot status={health} />{latestDeployment?.status === 'failed' ? <LastDeployFailed href={`/projects/${slug}/deployments/${latestDeployment.id}`} /> : null}</div></TableCell>
              <TableCell>{ready ?? 'Unknown'}/{config?.replicas ?? 0}</TableCell><TableCell className="font-mono text-xs">{imageTag(config?.image ?? null)}</TableCell>
              <TableCell className="text-right">{latestDeployment ? <Time value={latestDeployment.createdAt} /> : '—'}</TableCell>
            </TableRow>)}
          </TableBody></Table>}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Deployment history */}
        <Panel>
          <PanelHeader
            title="Deployment history"
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
            <ul className="divide-y divide-line">
              {deployments.map((row) => (
                <li
                  key={row.deployment.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">
                        {row.serviceName}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-2xs text-ink-muted">
                        {imageTag(row.deployment.imageAfter)}
                      </p>
                    </div>
                    <DeploymentStatus status={row.deployment.status} />
                  </div>
                  <Time value={row.deployment.createdAt} mode="auto" />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Routes */}
        <Panel>
          <PanelHeader title="Routes" />
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
              <div className="border-t border-line px-4 py-3">
                <Link
                  href={`/projects/${slug}/routes`}
                  className="text-link text-sm font-medium"
                >
                  Manage routes
                </Link>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}
