import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserOrganization,
  getProjectBySlug,
  getEnvironmentsByProject,
  getDeploymentsByProject,
  getRoutesByProject,
  getServicesByProject,
} from '@/lib/queries'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { StatusDot } from '@/components/status'
import { EmptyState } from '@/components/ui/empty-state'
import { Layers, Rocket, Globe } from 'lucide-react'

function relTime(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

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

  const [environments, deployments, routeRows, services] = await Promise.all([
    getEnvironmentsByProject(project.id),
    getDeploymentsByProject(project.id, 5),
    getRoutesByProject(project.id),
    getServicesByProject(project.id),
  ])

  return (
    <div className="space-y-5">
      {/* Environment ladder */}
      {environments.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Layers className="h-4 w-4" />}
            title="No environments"
            body="Create an environment to begin configuring deployments."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {environments.map((env) => {
            return (
              <Panel key={env.id}>
                <PanelHeader title={env.name} />
                <ul className="divide-y divide-line">
                  {services.length === 0 ? (
                    <li className="px-4 py-3 text-xs text-ink-muted">
                      No services configured
                    </li>
                  ) : (
                    services.map((svc) => {
                      const lastDeploy = deployments.find(
                        (d) =>
                          d.serviceName === svc.name &&
                          d.environmentName === env.name
                      )
                      return (
                        <li key={svc.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <Link
                                href={`/projects/${slug}/services/${svc.slug}?env=${encodeURIComponent(env.id)}`}
                                className="rounded text-[13px] font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                              >
                                {svc.name}
                              </Link>
                              {lastDeploy && (
                                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-muted">
                                  <span className="font-mono text-[11px]">
                                    {imageTag(lastDeploy.deployment.imageAfter)}
                                  </span>
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              {lastDeploy && (
                                <>
                                  <StatusDot status={lastDeploy.deployment.status} />
                                  <span className="text-2xs text-ink-faint">
                                    {relTime(lastDeploy.deployment.createdAt)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })
                  )}
                </ul>
                <div className="flex items-center justify-end gap-3 border-t border-line px-4 py-3">
                  <Link
                    href={`/projects/${slug}/environments/${env.slug}`}
                    className="rounded text-[12.5px] font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                  >
                    Open environment
                  </Link>
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Deployment history */}
        <Panel>
          <PanelHeader
            title="Deployment history"
            action={
              <Link
                href={`/projects/${slug}/deployments`}
                className="rounded text-[12.5px] font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                View all
              </Link>
            }
          />
          {deployments.length === 0 ? (
            <div className="px-4 py-6">
              <EmptyState
                icon={<Rocket className="h-4 w-4" />}
                title="No deployments yet"
                body="Deploy a service to see its history here."
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
                    <StatusDot status={row.deployment.status} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-ink">
                        {row.serviceName}
                        <span className="ml-2 text-ink-muted">→</span>
                        <Badge variant="secondary" className="ml-2">
                          {row.environmentName}
                        </Badge>
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">
                        {imageTag(row.deployment.imageAfter)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-2xs text-ink-faint">
                    {relTime(row.deployment.createdAt)}
                  </span>
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
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {routeRows.slice(0, 4).map((row) => (
                  <li key={row.route.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-mono text-[13px] text-ink">
                        {row.route.domain}
                      </span>
                      <Badge variant={row.route.tlsMode === 'auto' ? 'success' : 'outline'}>
                        TLS {row.route.tlsMode}
                      </Badge>
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
                  className="rounded text-[12.5px] font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
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
