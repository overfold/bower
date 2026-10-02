import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Globe } from 'lucide-react'
import {
  getProjectBySlug,
  getProjectEnvironment,
  getRoutesByProject,
  getServiceConfigs,
  getServicesByProject,
  getMergedServiceConfig,
} from '@/lib/queries'
import { getVerifiedOrganizationDomains } from '@/lib/domain-queries'
import { requireContext, requireProject } from '@/lib/actions/shared'
import { Button } from '@/components/ui/button'
import { EmptyState, InlineNotice } from '@/components/ui/empty-state'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddRouteDialog, RouteActions } from './route-actions'
import { protectionLabels, tlsLabels } from '@/lib/labels'

export default async function RoutesPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireContext()
  const { slug } = await params
  const project = await getProjectBySlug(ctx.org.id, slug)
  if (!project) redirect('/projects')

  const access = await requireProject(project.id)
  const [routeRows, services, environment, managedDomains] = await Promise.all([
    getRoutesByProject(project.id),
    getServicesByProject(project.id),
    getProjectEnvironment(project.id),
    getVerifiedOrganizationDomains(ctx.org.id),
  ])
  const serviceConfigs = environment
    ? await Promise.all(services.map(async (service) => ({ service, configs: await getServiceConfigs(service.id) })))
    : []
  const targetServices = serviceConfigs.filter(({ configs }) => configs.some((config) => config.environmentId === environment?.id)).map(({ service }) => service)
  const routeTargets = environment ? await Promise.all(targetServices.map(async (service) => {
    const config = await getMergedServiceConfig(service.id, environment.id)
    const env = config?.envVars as Record<string, unknown> | undefined
    const envPort = Number(env?.PORT)
    const validEnvPort = Number.isInteger(envPort) && envPort >= 1 && envPort <= 65535
    return { id: service.id, name: service.name, port: config?.healthCheckPort ?? (validEnvPort ? envPort : 80), portSource: config?.healthCheckPort ? 'Service health-check port' : validEnvPort ? 'Service PORT variable' : 'Default HTTP port; adjust to match your service' }
  })) : []
  const visibleRoutes = environment ? routeRows.filter((row) => row.route.environmentId === environment.id) : []
  const canManage = access.projectRole === 'admin'
  const canAddRoute = canManage && managedDomains.length > 0 && Boolean(environment) && targetServices.length > 0
  const addRouteAction = canAddRoute && environment ? (
    <AddRouteDialog
      projectId={project.id}
      environmentId={environment.id}
      services={routeTargets}
      domains={managedDomains.map((domain) => ({ id: domain.id, domain: domain.domain }))}
    />
  ) : null
  const emptyBody = !canManage
    ? 'Project administrator access is required to add a route.'
    : managedDomains.length === 0
      ? 'Verify an organization domain before adding a route.'
      : !environment
        ? 'Create a project environment before adding a route.'
        : targetServices.length === 0
          ? 'Configure a service before adding a route.'
          : 'Bind a hostname from a verified organization domain to expose a service.'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionTitle>Routes</SectionTitle>
          <p className="mt-1 text-sm text-ink-muted">
            Route verified hostnames to this project’s services.
          </p>
        </div>
        {addRouteAction}
      </div>

      {managedDomains.length === 0 ? (
        <InlineNotice
          tone="neutral"
          icon={<Globe className="h-4 w-4" />}
          action={ctx.role !== 'member' ? (
            <Button asChild size="sm">
              <Link href="/settings/domains">Manage domains</Link>
            </Button>
          ) : undefined}
        >
          <p className="font-medium text-ink">No verified organization domains</p>
          <p className="mt-0.5 text-xs text-ink-muted">Verify a domain before creating new routes.</p>
        </InlineNotice>
      ) : null}

      <Panel>
        <PanelHeader
          title={`${visibleRoutes.length} route${visibleRoutes.length === 1 ? '' : 's'}`}
        />
        {visibleRoutes.length === 0 ? (
          <EmptyState
            icon={<Globe className="h-4 w-4" />}
            title="No routes configured"
            body={emptyBody}
            action={addRouteAction}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>TLS</TableHead>
                <TableHead>Protection</TableHead>
                <TableHead className="w-[96px]"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRoutes.map((row) => (
                <TableRow key={row.route.id}>
                  <TableCell className="font-mono text-sm font-medium text-ink">{row.route.domain}</TableCell>
                  <TableCell className="font-mono text-xs text-ink-muted">{row.route.pathPrefix}</TableCell>
                  <TableCell className="text-sm">{row.serviceName}:{row.route.port}</TableCell>
                  <TableCell>
                    <span className="text-sm text-ink-muted">{tlsLabels[row.route.tlsMode]}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-ink-muted">{protectionLabels[row.route.protectionMode]}</span>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <RouteActions projectId={project.id} routeId={row.route.id} hostname={row.route.domain} currentMode={row.route.protectionMode} />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
