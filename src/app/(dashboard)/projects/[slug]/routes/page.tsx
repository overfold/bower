import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Globe } from 'lucide-react'
import {
  getEnvironmentsByProject,
  getProjectBySlug,
  getRoutesByProject,
  getServicesByProject,
} from '@/lib/queries'
import { getVerifiedOrganizationDomains } from '@/lib/domain-queries'
import { requireContext, requireProject } from '@/lib/actions/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, InlineNotice } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddRouteDialog, DeleteRouteButton } from './route-actions'

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
  const [routeRows, services, environments, managedDomains] = await Promise.all([
    getRoutesByProject(project.id),
    getServicesByProject(project.id),
    getEnvironmentsByProject(project.id),
    getVerifiedOrganizationDomains(ctx.org.id),
  ])
  const canManage = access.projectRole === 'admin'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Routes</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Hostnames come from domains verified at the organization level.
          </p>
        </div>
        {canManage ? (
          <AddRouteDialog
            projectId={project.id}
            services={services.map((service) => ({ id: service.id, name: service.name }))}
            environments={environments.map((environment) => ({ id: environment.id, name: environment.name }))}
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
          title={`${routeRows.length} route${routeRows.length === 1 ? '' : 's'}`}
          hint="Project hostname bindings"
        />
        {routeRows.length === 0 ? (
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
                <TableHead>Environment</TableHead>
                <TableHead>TLS</TableHead>
                <TableHead className="w-[56px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routeRows.map((row) => (
                <TableRow key={row.route.id}>
                  <TableCell className="font-mono text-[12.5px] font-medium text-ink">{row.route.domain}</TableCell>
                  <TableCell className="font-mono text-xs text-ink-muted">{row.route.pathPrefix}</TableCell>
                  <TableCell className="text-[13px]">{row.serviceName}:{row.route.port}</TableCell>
                  <TableCell><Badge variant="secondary">{row.environmentName}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={tlsBadgeVariant[row.route.tlsMode] ?? 'outline'}>{row.route.tlsMode}</Badge>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <DeleteRouteButton projectId={project.id} routeId={row.route.id} hostname={row.route.domain} />
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
