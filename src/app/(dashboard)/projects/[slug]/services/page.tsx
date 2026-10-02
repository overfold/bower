import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment } from '@/lib/queries'
import { requireProject } from '@/lib/actions/shared'
import { Panel, SectionTitle } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { CreateServiceDialog } from '@/components/create-service-dialog'
import { Server } from 'lucide-react'
import { StatusDot } from '@/components/status'
import { Time } from '@/components/time'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { TrellisReadError } from '@/components/trellis-read-error'
import { getProjectLiveServices } from '@/lib/service-health-query'
import { LastDeployFailed } from '@/components/last-deploy-failed'
import { getTrellisClient } from '@/lib/trellis-instance'

export default async function ServicesPage({
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

  const environment = await getProjectEnvironment(project.id)
  const { services: summaries, error: allocationError } = await getProjectLiveServices(ctx.org.id, project.id, environment)
  const limits = access.projectRole === 'admin' ? await getTrellisClient(ctx.org.id).then((client) => client.getClusterSettings()).then((settings) => settings.job_limits).catch(() => undefined) : undefined

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><SectionTitle>Services</SectionTitle><p className="mt-1 text-sm text-ink-muted">Manage the workloads deployed by this project.</p></div>
        {access.projectRole === 'admin' ? <CreateServiceDialog projectSlug={slug} limits={limits} /> : null}
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
          {allocationError ? <TrellisReadError title="Replica readiness unavailable" message={allocationError} /> : null}
          <Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Service</TableHead><TableHead>Image</TableHead><TableHead>Ready / desired</TableHead><TableHead>Last deploy</TableHead><TableHead>Routes</TableHead></TableRow></TableHeader>
            <TableBody>{summaries.map(({ service, config, latestDeployment, routeCount, ready, health }) => {
              return <TableRow key={service.id} className="relative">
                <TableCell><div className="flex flex-wrap items-center gap-2"><StatusDot status={health} />{latestDeployment?.status === 'failed' ? <LastDeployFailed href={`/projects/${slug}/deployments/${latestDeployment.id}`} /> : null}</div></TableCell>
                <TableCell><Link href={`/projects/${slug}/services/${service.slug}`} className="text-link font-medium">{service.name}</Link></TableCell>
                <TableCell className="font-mono text-xs">{config?.image ?? 'No image configured'}</TableCell>
                <TableCell>{ready ?? 'Unknown'} / {config?.replicas ?? 0}</TableCell>
                <TableCell className="text-right">{latestDeployment ? <Time value={latestDeployment.createdAt} /> : '—'}</TableCell>
                <TableCell>{routeCount}</TableCell>
              </TableRow>
            })}</TableBody>
          </Table>
        </Panel>
      )}
    </div>
  )
}
