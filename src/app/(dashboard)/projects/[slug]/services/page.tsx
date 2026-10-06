import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment } from '@/lib/queries'
import { requireProject } from '@/lib/actions/shared'
import { Panel, PanelHeader, SectionTitle } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { CreateServiceDialog } from '@/components/create-service-dialog'
import { ChevronRight, Server } from 'lucide-react'
import { StatusDot } from '@/components/status'
import { Time } from '@/components/time'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { TrellisReadError } from '@/components/trellis-read-error'
import { getProjectLiveServices } from '@/lib/service-health-query'
import { formatReadyReplicas } from '@/lib/format'
import { LastDeployFailed } from '@/components/last-deploy-failed'
import { isUnsuccessfulDeployment } from '@/lib/status'
import { getTrellisClient } from '@/lib/trellis-instance'
import { ClickableTableRow } from '@/components/clickable-table-row'

export default async function ServicesPage({
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

  const environment = await getProjectEnvironment(project.id)
  const { services: summaries, error: allocationError } = await getProjectLiveServices(ctx.org.id, project.id, environment)
  const limits = access.projectRole === 'admin' ? await getTrellisClient(ctx.org.id).then((client) => client.getClusterSettings()).then((settings) => settings.job_limits).catch(() => undefined) : undefined

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle>Services</SectionTitle>
      </div>

      {summaries.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Server className="h-4 w-4" />}
            title="No services yet"
            body="Create your first service to start deploying."
            action={access.projectRole === 'admin' ? <CreateServiceDialog projectSlug={slug} limits={limits} /> : undefined}
          />
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title={`${summaries.length} ${summaries.length === 1 ? 'service' : 'services'}`} action={access.projectRole === 'admin' ? <CreateServiceDialog projectSlug={slug} limits={limits} /> : undefined} />
          {allocationError ? <TrellisReadError title="Replica readiness unavailable" message={allocationError} /> : null}
          <Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Service</TableHead><TableHead>Image</TableHead><TableHead>Ready / desired</TableHead><TableHead>Last deploy</TableHead><TableHead>Routes</TableHead><TableHead className="w-12"><span className="sr-only">View</span></TableHead></TableRow></TableHeader>
            <TableBody>{summaries.map(({ service, config, latestDeployment, routeCount, ready, health }) => {
              const href = `/projects/${slug}/services/${service.slug}`
              return <ClickableTableRow key={service.id} href={href} label={`View service ${service.name}`}>
                <TableCell><div className="flex flex-wrap items-center gap-2"><StatusDot status={health} />{latestDeployment && isUnsuccessfulDeployment(latestDeployment.status) ? <LastDeployFailed href={`/projects/${slug}/deployments/${latestDeployment.id}`} outcome={latestDeployment.status === 'rolled_back' ? 'rolled_back' : 'failed'} /> : null}</div></TableCell>
                <TableCell><Link href={href} className="text-link font-medium">{service.name}</Link></TableCell>
                <TableCell className="font-mono text-xs">{config?.image ?? 'No image configured'}</TableCell>
                <TableCell>{formatReadyReplicas(ready, config?.replicas ?? 0)}</TableCell>
                <TableCell className="text-right">{latestDeployment ? <Time value={latestDeployment.createdAt} /> : '—'}</TableCell>
                <TableCell>{routeCount}</TableCell>
                <TableCell><ChevronRight className="ml-auto h-4 w-4 text-ink-muted" aria-hidden="true" /></TableCell>
              </ClickableTableRow>
            })}</TableBody>
          </Table>
        </Panel>
      )}
    </div>
  )
}
