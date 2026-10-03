import { notFound } from 'next/navigation'
import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { deploymentEvents, deployments, environments, serviceConfigs, services, users } from '@/db/schema'
import { requireContext, requireProject } from '@/lib/actions/shared'
import { getProjectBySlug } from '@/lib/queries'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { DeploymentStatus } from '@/components/status'
import { InlineNotice } from '@/components/ui/feedback'
import { DeploymentDiagnosticActions } from './deployment-diagnostic-actions'
import { label } from '@/lib/labels'
import { EventDetails } from './event-details'
import { Button } from '@/components/ui/button'
import { formatDeploymentDuration, shortDeploymentImage } from '@/lib/format'
import { Timeline } from '@/components/timeline'
import { Time } from '@/components/time'
import { getTrellisClient } from '@/lib/trellis-instance'
import { earlierSuccessfulReleases, runningRelease } from '@/lib/service-releases'
import { trellisReadError } from '@/lib/trellis-runtime'

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
  const [events, journal, configRow] = await Promise.all([
    db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, deploymentId)).orderBy(deploymentEvents.createdAt),
    db.select().from(deployments).where(and(eq(deployments.serviceId, row.service.id), eq(deployments.environmentId, row.deployment.environmentId))).orderBy(desc(deployments.createdAt)),
    db.select({ config: serviceConfigs, environment: environments }).from(serviceConfigs).innerJoin(environments, eq(environments.id, serviceConfigs.environmentId)).where(and(eq(serviceConfigs.serviceId, row.service.id), eq(serviceConfigs.environmentId, row.deployment.environmentId))).limit(1).then((items) => items[0]),
  ])
  const jobName = configRow?.config.activeJobName || row.service.slug
  const client = await getTrellisClient(ctx.org.id)
  const runtime = configRow ? await client.getJob(jobName, configRow.environment.trellisNamespace).catch(() => null) : null
  const active = runningRelease(journal, runtime ? { name: jobName, version: runtime.version, revision: runtime.revision } : null)
  const rollbackTargets = earlierSuccessfulReleases(journal, active)

  const failedEvent = events.findLast((event) => /fail|error/i.test(`${event.type} ${event.message}`))
  const allocationDetails = events.flatMap((event) => {
    const details = event.details as Record<string, unknown>
    return Array.isArray(details.allocations) ? details.allocations : []
  })
  const failedAllocation = allocationDetails.find((allocation) => allocation && typeof allocation.id === 'string')
  let failureLogs: string[] = []
  let failureLogError: string | null = null
  if (failedAllocation && configRow) {
    try {
      const allocations = await client.listAllocations({ namespace: configRow.environment.trellisNamespace })
      const allocation = allocations.find((item) => item.id === failedAllocation.id)
      if (allocation) {
        const versions = await client.getJobVersions(allocation.job, allocation.namespace)
        const spec = runtime?.name === allocation.job && runtime.revision === allocation.job_revision ? runtime.spec : versions.find((version) => version.revision === allocation.job_revision)?.spec
        const tasks = spec?.task_groups.find((group) => group.name === allocation.group)?.tasks.map((task) => task.name) ?? []
        const results = await Promise.allSettled(tasks.map((task) => client.getAllocationLogs(allocation.id, task, allocation.namespace, 10)))
        failureLogs = results.flatMap((result) => result.status === 'fulfilled' ? result.value.split('\n') : []).filter(Boolean).slice(-10)
        const rejected = results.find((result) => result.status === 'rejected')
        if (!failureLogs.length && rejected?.status === 'rejected') failureLogError = trellisReadError(rejected.reason)
      }
    } catch (error) { failureLogError = trellisReadError(error) }
  }
  const serviceHref = `/projects/${slug}/services/${row.service.slug}`

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Link href={serviceHref} className="text-sm font-medium text-link">{row.service.name}</Link><div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="break-words text-2xl font-bold text-ink">{shortDeploymentImage(row.deployment.imageAfter)}</h1><DeploymentStatus status={row.deployment.status} /></div><div className="mt-2 text-sm text-ink-muted"><Time value={row.deployment.createdAt} mode="absolute" /> · {label(row.deployment.triggerType)} · {row.userName ?? 'System'}</div></div>{access.projectRole !== 'viewer' ? <DeploymentDiagnosticActions serviceId={row.service.id} serviceName={row.service.name} environmentId={row.deployment.environmentId} failed={row.deployment.status === 'failed'} runningImage={active?.imageAfter} rollbackTargets={rollbackTargets.map((target) => ({ id: target.id, image: target.imageAfter }))} configurationHref={`${serviceHref}/configuration`} /> : null}</div>
    {row.deployment.status === 'failed' && <InlineNotice tone="danger"><p className="font-medium">{failedEvent?.message ?? 'The deployment failed.'}</p>{failureLogs.length ? <pre className="mt-2 max-h-52 overflow-auto rounded bg-sunken p-3 text-xs text-ink">{failureLogs.join('\n')}</pre> : <p className="mt-1 text-sm text-ink-muted">{failureLogError ? `Allocation logs unavailable: ${failureLogError}` : 'No log output was captured.'}</p>}<div className="mt-2"><Button asChild size="sm"><Link href={failedAllocation ? `${serviceHref}/allocations/${encodeURIComponent(failedAllocation.id)}` : serviceHref}>Open allocation</Link></Button></div></InlineNotice>}
    <Panel><PanelHeader title="Summary" /><dl className="px-4">
      <KeyValue label="Image" mono>{row.deployment.imageBefore ? <><span className="text-ink-muted">{row.deployment.imageBefore}</span> → </> : null}{row.deployment.imageAfter}</KeyValue>
      <KeyValue label="Strategy">{label(row.deployment.strategy)}</KeyValue>
      <KeyValue label="Duration">{row.deployment.completedAt ? formatDeploymentDuration(row.deployment.startedAt, row.deployment.completedAt) : 'In progress'}</KeyValue>
      <KeyValue label="Revision">{row.deployment.trellisRevision ?? '—'}</KeyValue>
    </dl></Panel>
    <Panel><PanelHeader title="Events" />
      {events.length ? <Timeline items={events.map((event) => {
        const failed = /fail|error/i.test(`${event.type} ${event.message}`)
        const tone = failed ? 'danger' : /backoff|blocked/i.test(event.type) ? 'warning' : /healthy|complete|success/i.test(event.type) ? 'success' : 'neutral'
        return { id: event.id, title: event.message, titleTooltip: event.type, tone, time: <Time value={event.createdAt} mode="absolute" />, description: Object.keys(event.details as object).length ? <EventDetails details={event.details as Record<string, unknown>} /> : null }
      })} /> : <p className="p-4 text-sm text-ink-muted">No deployment events were recorded.</p>}
    </Panel>
  </div>
}
