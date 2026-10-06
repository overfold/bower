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
import { deploymentStatusLabels, label } from '@/lib/labels'
import { EventDetails } from './event-details'
import { Button } from '@/components/ui/button'
import { deploymentImageTag, formatDeploymentDuration, shortDeploymentImage, triggerActor } from '@/lib/format'
import { Timeline } from '@/components/timeline'
import { Time } from '@/components/time'
import { getTrellisClient } from '@/lib/trellis-instance'
import { earlierSuccessfulReleases, runningRelease } from '@/lib/service-releases'
import { trellisReadError } from '@/lib/trellis-runtime'
import { diffJobSpecs } from '@/lib/service-config-diff'
import { deploymentDetailState, failureLogState, previousSuccessfulRelease } from '@/lib/deployment-detail-state'
import { deploymentEventTone, failedAllocationId, failureEvent } from '@/lib/deployment-events'
import { isUnsuccessfulDeployment } from '@/lib/status'
import { ConfigDiffPreview } from '../../services/[serviceSlug]/service-actions'

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
  const { superseding, primaryRecovery } = deploymentDetailState(journal, deploymentId)

  const unsuccessful = isUnsuccessfulDeployment(row.deployment.status)
  const rolledBack = row.deployment.status === 'rolled_back'
  const failedEvent = unsuccessful ? failureEvent(events) : undefined
  const failedAllocationIdValue = unsuccessful ? failedAllocationId(events) : undefined
  let failureLogs: string[] = []
  let failureLogError: string | null = null
  let allocationsReadable = true
  let allocationFound = false
  if (failedAllocationIdValue && configRow) {
    try {
      const allocations = await client.listAllocations({ namespace: configRow.environment.trellisNamespace })
      const allocation = allocations.find((item) => item.id === failedAllocationIdValue)
      allocationFound = Boolean(allocation)
      if (allocation) {
        const versions = await client.getJobVersions(allocation.job, allocation.namespace)
        const spec = runtime?.name === allocation.job && runtime.revision === allocation.job_revision ? runtime.spec : versions.find((version) => version.revision === allocation.job_revision)?.spec
        const tasks = spec?.task_groups.find((group) => group.name === allocation.group)?.tasks.map((task) => task.name) ?? []
        const results = await Promise.allSettled(tasks.map((task) => client.getAllocationLogs(allocation.id, task, allocation.namespace, 10)))
        failureLogs = results.flatMap((result) => result.status === 'fulfilled' ? result.value.split('\n') : []).filter(Boolean).slice(-10)
        const rejected = results.find((result) => result.status === 'rejected')
        if (!failureLogs.length && rejected?.status === 'rejected') failureLogError = trellisReadError(rejected.reason)
      }
    } catch (error) { allocationsReadable = false; failureLogError = trellisReadError(error) }
  }
  const logState = failureLogState({ allocationId: failedAllocationIdValue, allocationsReadable, allocationFound, lines: failureLogs, error: failureLogError })
  const previousRelease = unsuccessful ? previousSuccessfulRelease(journal, deploymentId) : undefined
  const changesFromPrevious = previousRelease ? diffJobSpecs(row.deployment.jobSpec, previousRelease.jobSpec) : []
  const diagnosticEvents = events.filter((event) => ['scheduling_blocked', 'replacement_backoff', 'reconciliation_error'].includes(event.type) && event.id !== failedEvent?.id)
  const serviceHref = `/projects/${slug}/services/${row.service.slug}`

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Link href={serviceHref} className="text-sm font-medium text-link">{row.service.name}</Link><div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="break-words text-2xl font-bold text-ink">{shortDeploymentImage(row.deployment.imageAfter)}</h1><DeploymentStatus status={row.deployment.status} /></div><div className="mt-2 text-sm text-ink-muted"><Time value={row.deployment.createdAt} mode="absolute" /> · {label(row.deployment.triggerType)} · {triggerActor(row.deployment.triggerType, row.userName)}</div></div>{access.projectRole !== 'viewer' ? <DeploymentDiagnosticActions serviceId={row.service.id} serviceName={row.service.name} environmentId={row.deployment.environmentId} primaryRecovery={primaryRecovery} runningImage={active?.imageAfter} rollbackTargets={rollbackTargets.map((target) => ({ id: target.id, image: target.imageAfter, createdAt: target.createdAt, changes: diffJobSpecs(target.jobSpec, runtime?.spec ?? active?.jobSpec) }))} configurationHref={`${serviceHref}/configuration`} /> : null}</div>
    {superseding ? <InlineNotice tone="neutral">Superseded by <span className="font-mono font-medium">{deploymentImageTag(superseding.imageAfter)}</span> · {deploymentStatusLabels[superseding.status].toLowerCase()} <Time value={superseding.completedAt ?? superseding.createdAt} /> · <Link className="font-medium underline" href={`/projects/${slug}/deployments/${superseding.id}`}>View</Link></InlineNotice> : null}
    {unsuccessful && <InlineNotice tone={rolledBack ? 'warn' : 'danger'}>
      <p className="font-medium">{rolledBack ? `Rolled back automatically: ${failedEvent?.message ?? 'the rollout did not converge.'}` : failedEvent?.message ?? 'The deployment failed.'}</p>
      {rolledBack && diagnosticEvents.length ? <ul className="mt-1 list-disc pl-4 text-sm text-ink-soft">{diagnosticEvents.map((event) => <li key={event.id}>{event.message}</li>)}</ul> : null}
      {logState.kind === 'logs' ? <pre className="mt-2 max-h-52 overflow-auto rounded bg-sunken p-3 text-xs text-ink">{failureLogs.join('\n')}</pre> : <p className="mt-1 text-sm text-ink-muted">{logState.message}</p>}
      <div className="mt-2"><Button asChild size="sm"><Link href={logState.allocationHref && failedAllocationIdValue ? `${serviceHref}/allocations/${encodeURIComponent(failedAllocationIdValue)}` : serviceHref}>{logState.allocationHref && failedAllocationIdValue ? 'Open allocation' : 'Open service'}</Link></Button></div>
    </InlineNotice>}
    <Panel><PanelHeader title="Summary" /><dl className="grid gap-x-8 px-4 sm:grid-cols-3">
      <div className="sm:col-span-3"><KeyValue label="Image" mono>{row.deployment.imageBefore ? <><span className="text-ink-muted">{row.deployment.imageBefore}</span> → </> : null}{row.deployment.imageAfter}</KeyValue></div>
      <KeyValue label="Strategy">{label(row.deployment.strategy)}</KeyValue>
      <KeyValue label="Duration">{row.deployment.completedAt ? formatDeploymentDuration(row.deployment.startedAt, row.deployment.completedAt) : 'In progress'}</KeyValue>
      <KeyValue label="Revision">{row.deployment.trellisRevision ?? '—'}</KeyValue>
    </dl></Panel>
    {unsuccessful ? <Panel><PanelHeader title="Changes from previous successful release" hint={previousRelease ? <span className="font-mono">{deploymentImageTag(previousRelease.imageAfter)}</span> : undefined} />
      {!previousRelease ? <p className="p-4 text-sm text-ink-muted">There is no earlier successful release to compare against.</p> : <ConfigDiffPreview changes={changesFromPrevious} beforeLabel="Previous release" afterLabel="This deployment" flush />}
    </Panel> : null}
    <Panel><PanelHeader title="Events" />
      {events.length ? <Timeline items={events.map((event) => {
        return { id: event.id, title: event.message, titleTooltip: event.type, tone: deploymentEventTone(event.type), time: <Time value={event.createdAt} mode="absolute" />, description: Object.keys(event.details as object).length ? <EventDetails details={event.details as Record<string, unknown>} /> : null }
      })} /> : <p className="p-4 text-sm text-ink-muted">No deployment events were recorded.</p>}
    </Panel>
  </div>
}
