import { notFound } from 'next/navigation'
import Link from 'next/link'
import { and, desc, eq, isNotNull, lt } from 'drizzle-orm'
import { db } from '@/db'
import { deploymentEvents, deployments, services, users } from '@/db/schema'
import { requireContext, requireProject } from '@/lib/actions/shared'
import { getProjectBySlug } from '@/lib/queries'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { DeploymentStatus } from '@/components/status'
import { formatTimestamp } from '@/lib/format'
import { InlineNotice } from '@/components/ui/feedback'
import { DeploymentDiagnosticActions } from './deployment-diagnostic-actions'
import { label } from '@/lib/labels'
import { EventDetails } from './event-details'
import { Button } from '@/components/ui/button'

export default async function DeploymentDetailPage({ params }: { params: Promise<{ slug: string; deploymentId: string }> }) {
  const { slug, deploymentId } = await params
  const ctx = await requireContext()
  const project = await getProjectBySlug(ctx.org.id, slug)
  if (!project) notFound()
  const access = await requireProject(project.id)
  const [row] = await db.select({ deployment: deployments, service: services, userName: users.name })
    .from(deployments)
    .innerJoin(services, eq(services.id, deployments.serviceId))
    .leftJoin(users, eq(users.id, deployments.triggeredByUserId))
    .where(and(eq(deployments.id, deploymentId), eq(services.projectId, project.id)))
    .limit(1)
  if (!row) notFound()
  const [events, previousSuccessful] = await Promise.all([
    db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, deploymentId)).orderBy(deploymentEvents.createdAt),
    row.deployment.status === 'failed' ? db.select().from(deployments).where(and(
      eq(deployments.serviceId, row.service.id),
      eq(deployments.environmentId, row.deployment.environmentId),
      eq(deployments.status, 'healthy'),
      isNotNull(deployments.jobSpec),
      lt(deployments.createdAt, row.deployment.createdAt),
    )).orderBy(desc(deployments.createdAt)).limit(1).then((items) => items[0]) : Promise.resolve(row.deployment.status === 'healthy' && row.deployment.jobSpec ? row.deployment : undefined),
  ])

  const duration = row.deployment.completedAt
    ? Math.max(0, Math.round((row.deployment.completedAt.getTime() - row.deployment.startedAt.getTime()) / 1000))
    : null
  const failedEvent = events.findLast((event) => /fail|error/i.test(`${event.type} ${event.message}`))
  const allocationDetails = events.flatMap((event) => {
    const details = event.details as Record<string, unknown>
    return Array.isArray(details.allocations) ? details.allocations : []
  })
  const failedAllocation = allocationDetails.find((allocation) => allocation && typeof allocation.id === 'string')
  const serviceHref = `/projects/${slug}/services/${row.service.slug}`

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-2"><h1 className="break-words text-xl font-semibold text-ink">{row.deployment.imageAfter.split('/').at(-1)} · {formatTimestamp(row.deployment.createdAt)}</h1><p className="text-sm text-ink-muted">{row.service.name}</p><DeploymentStatus status={row.deployment.status} /></div>{access.projectRole !== 'viewer' ? <DeploymentDiagnosticActions serviceId={row.service.id} environmentId={row.deployment.environmentId} rollbackTarget={previousSuccessful ? { id: previousSuccessful.id, image: previousSuccessful.imageAfter } : undefined} configurationHref={`${serviceHref}/configuration`} /> : null}</div>
    {row.deployment.status === 'failed' && <InlineNotice tone="danger"><span>{failedEvent?.message ?? 'The deployment failed. Review the event timeline for details.'}</span><div className="mt-2"><Button asChild size="sm"><Link href={failedAllocation ? `${serviceHref}/allocations/${encodeURIComponent(failedAllocation.id)}#logs` : serviceHref}>View allocations</Link></Button></div></InlineNotice>}
    <Panel><PanelHeader title="Summary" /><dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <KeyValue label="Service">{row.service.name}</KeyValue>
      <div className="min-w-0 py-2.5 sm:col-span-2"><dt className="text-xs text-ink-muted">Image before → after</dt><dd className="mt-1 break-all font-mono text-sm text-ink">{row.deployment.imageBefore ?? '—'} → {row.deployment.imageAfter}</dd></div>
      <KeyValue label="Trigger">{label(row.deployment.triggerType)} · {row.userName ?? 'System'}</KeyValue>
      <KeyValue label="Strategy">{label(row.deployment.strategy)}</KeyValue>
      <KeyValue label="Started">{formatTimestamp(row.deployment.startedAt)}</KeyValue>
      <KeyValue label="Duration">{duration === null ? 'In progress' : `${duration}s`}</KeyValue>
    </dl></Panel>
    <Panel><PanelHeader title="Events" />
      {events.length ? <ol className="px-4">{events.map((event) => {
        const failed = /fail|error/i.test(`${event.type} ${event.message}`)
        const tone = failed ? 'bg-danger-500' : /backoff|blocked/i.test(event.type) ? 'bg-warn-500' : /healthy|complete|success/i.test(event.type) ? 'bg-ok-500' : 'bg-info-500'
        return <li key={event.id} className="relative border-l border-line py-4 pl-5">
          <span className={`absolute -left-1.5 top-5 h-3 w-3 rounded-full ${tone}`} />
          <p className={`font-medium ${failed ? 'text-danger-500' : 'text-ink'}`}>{event.message}</p>
          <p className="mt-1 text-xs text-ink-muted">{label(event.type)} · {formatTimestamp(event.createdAt)}</p>
          {Object.keys(event.details as object).length ? <EventDetails details={event.details as Record<string, unknown>} /> : null}
        </li>
      })}</ol> : <p className="p-4 text-sm text-ink-muted">No deployment events were recorded.</p>}
    </Panel>
  </div>
}
