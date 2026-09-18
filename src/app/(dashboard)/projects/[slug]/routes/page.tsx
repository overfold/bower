import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Globe } from 'lucide-react'
import {
  getProjectBySlug,
  getProjectEnvironment,
  getRoutesByProject,
  getServiceConfigs,
  getServicesByProject,
} from '@/lib/queries'
import { getVerifiedOrganizationDomains } from '@/lib/domain-queries'
import { requireContext, requireProject } from '@/lib/actions/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, InlineNotice } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddRouteDialog, DeleteRouteButton, RouteProtectionButton } from './route-actions'

const tlsBadgeVariant: Record<string, 'success' | 'secondary' | 'outline'> = {
  auto: 'success',
  custom: 'secondary',
  none: 'outline',
}

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
  const visibleRoutes = environment ? routeRows.filter((row) => row.route.environmentId === environment.id) : []
  const canManage = access.projectRole === 'admin'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Routes</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Route verified hostnames to this project’s services.
          </p>
        </div>
        {canManage && managedDomains.length > 0 && environment ? (
          <AddRouteDialog
            projectId={project.id}
            environmentId={environment.id}
            services={targetServices.map((service) => ({ id: service.id, name: service.name }))}
            domains={managedDomains.map((domain) => ({ id: domain.id, domain: domain.domain }))}
          />
        ) : null}
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
            body="Bind a hostname from a verified organization domain to expose a service."
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
                <TableHead className="w-[96px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRoutes.map((row) => (
                <TableRow key={row.route.id}>
                  <TableCell className="font-mono text-[12.5px] font-medium text-ink">{row.route.domain}</TableCell>
                  <TableCell className="font-mono text-xs text-ink-muted">{row.route.pathPrefix}</TableCell>
                  <TableCell className="text-[13px]">{row.serviceName}:{row.route.port}</TableCell>
                  <TableCell>
                    <Badge variant={tlsBadgeVariant[row.route.tlsMode] ?? 'outline'}>{row.route.tlsMode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.route.protectionMode === 'none' ? 'outline' : 'secondary'}>
                      {row.route.protectionMode === 'bower_auth' ? 'Bower auth' : row.route.protectionMode}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <div className="flex items-center justify-end gap-1">
                        <RouteProtectionButton projectId={project.id} routeId={row.route.id} hostname={row.route.domain} currentMode={row.route.protectionMode} />
                        <DeleteRouteButton projectId={project.id} routeId={row.route.id} hostname={row.route.domain} />
                      </div>
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
