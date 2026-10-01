import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock3 } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment, getServiceBySlug, getServiceConfigsWithEnvironments } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { allocationBelongsToService, trellisReadError } from '@/lib/trellis-runtime'
import { getProjectRole } from '@/lib/actions/shared'
import { TrellisReadError } from '@/components/trellis-read-error'
import { NodeLink } from '@/components/node-link'
import { PageHeading, MetaItem } from '@/components/page-heading'
import { Panel, PanelHeader, KeyValue, SectionTitle } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { Chip, StatusDot } from '@/components/status'
import { ExecDialog } from '@/components/exec-dialog'
import { AllocationMetrics } from './allocation-metrics'
import { AllocationStopButton } from './allocation-stop-button'
import type { TrellisAllocation } from '@/types/trellis'

export default async function AllocationDetailPage({
  params,
}: {
  params: Promise<{ slug: string; serviceSlug: string; allocationId: string }>
}) {
  const { slug, serviceSlug, allocationId } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  if (!await getProjectRole(user.id, orgCtx.role, project.id)) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const [configs, environment] = await Promise.all([
    getServiceConfigsWithEnvironments(service.id),
    getProjectEnvironment(project.id),
  ])
  const selectedConfig = environment ? configs.find((row) => row.environment.id === environment.id) : null
  if (!selectedConfig) notFound()
  let allocation: TrellisAllocation | null = null
  let client: Awaited<ReturnType<typeof getTrellisClient>>

  try {
    client = await getTrellisClient(orgCtx.org.id)
    const allocs = await client.listAllocations({ namespace: selectedConfig.environment.trellisNamespace })
    allocation = allocs.find((item) => item.id === allocationId
      && allocationBelongsToService(item, selectedConfig.environment.trellisNamespace, service.slug, [service.slug, selectedConfig.config.activeJobName])) ?? null
  } catch (error) {
    return <Panel><TrellisReadError title="Allocation unavailable" message={trellisReadError(error)} /></Panel>
  }
  if (!allocation) notFound()

  const matchingConfig = configs.find(({ environment }) => environment.trellisNamespace === allocation?.namespace)
  const [events, metrics, job, versions] = await Promise.allSettled([
    client.getAllocationEvents(allocationId, allocation.namespace),
    client.getAllocationMetrics(allocationId, allocation.namespace),
    client.getJob(allocation.job, allocation.namespace),
    client.getJobVersions(allocation.job, allocation.namespace),
  ])
  const allocationSpec = job.status === 'fulfilled' && job.value.revision === allocation.job_revision
    ? job.value.spec
    : versions.status === 'fulfilled'
      ? versions.value.find((entry) => entry.revision === allocation.job_revision)?.spec
      : undefined
  const terminalTasks = allocationSpec?.task_groups
    .find((group) => group.name === allocation.group)
    ?.tasks.map((task) => task.name) ?? []
  const logs = await Promise.allSettled(terminalTasks.map((task) => client.getAllocationLogs(allocationId, task, allocation.namespace)))
  const history = events.status === 'fulfilled' ? [...events.value].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)) : []
  const stoppable = !['stopping', 'stopped', 'lost'].includes(allocation.phase)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href={`/projects/${slug}/services/${serviceSlug}`} className="mt-2 text-ink-muted transition-colors hover:text-ink" aria-label="Back to service">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <PageHeading
            title={allocationId.slice(0, 8)}
            meta={
              <>
                <MetaItem label="Service" value={service.name} />
                <MetaItem label="Phase" value={<StatusDot status={allocation.phase} />} />
                <MetaItem label="Health" value={<StatusDot status={allocation.health} />} />
                <MetaItem label="Namespace" value={<span className="font-mono text-[11.5px]">{allocation.namespace}</span>} />
              </>
            }
            actions={
              <>
                {matchingConfig && <ExecDialog allocationId={allocationId} serviceConfigId={matchingConfig.config.id} tasks={terminalTasks} />}
                <AllocationStopButton serviceId={service.id} allocationId={allocationId} disabled={!stoppable} />
              </>
            }
          />
        </div>
      </div>

      <AllocationMetrics serviceId={service.id} allocationId={allocationId} initialMetrics={metrics.status === 'fulfilled' ? metrics.value : []} initialError={metrics.status === 'rejected' ? trellisReadError(metrics.reason) : null} />

      <Panel>
        <PanelHeader title="Allocation details" />
        <div className="p-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 md:grid-cols-4">
            <KeyValue label="Group" mono>{allocation.group}</KeyValue>
            <KeyValue label="Job" mono>{allocation.job}</KeyValue>
            <KeyValue label="Node" mono><NodeLink id={allocation.node_id} /></KeyValue>
            <KeyValue label="Revision">{allocation.job_revision}</KeyValue>
            <KeyValue label="Generation">{allocation.generation}</KeyValue>
            <KeyValue label="Attempt">{allocation.attempt}</KeyValue>
            <KeyValue label="Created">{new Date(allocation.created_at).toLocaleString()}</KeyValue>
            <KeyValue label="Last transition">{new Date(allocation.last_transition_at).toLocaleString()}</KeyValue>
          </dl>
          {(allocation.reason || allocation.message || allocation.draining) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {allocation.draining && <Badge variant="warning">Draining</Badge>}
              {allocation.reason && <Chip tone={allocation.phase === 'failed' || allocation.phase === 'lost' ? 'danger' : 'neutral'}>{allocation.reason}</Chip>}
              {allocation.message && <p className="text-[12.5px] text-ink-muted">{allocation.message}</p>}
            </div>
          )}
        </div>
      </Panel>

      <div className="space-y-4">
        <SectionTitle>Lifecycle history</SectionTitle>
        <Panel>
          {events.status === 'rejected' ? <TrellisReadError title="Lifecycle events unavailable" message={trellisReadError(events.reason)} /> : history.length === 0 ? (
            <div className="p-5 text-[13px] text-ink-muted">No lifecycle events have been recorded.</div>
          ) : (
            <ol className="px-4 py-2">
              {history.map((event, index) => (
                <li key={`${event.at}-${event.phase}-${index}`} className="relative flex gap-4 py-3.5">
                  {index < history.length - 1 && <span className="absolute left-[7px] top-7 h-[calc(100%-0.5rem)] w-px bg-line" aria-hidden="true" />}
                  <span className="relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-surface bg-brand-500 ring-1 ring-line-strong" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusDot status={event.phase} />
                      {event.reason && <Chip tone="neutral">{event.reason}</Chip>}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{event.message || 'Lifecycle transition'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-2xs text-ink-muted">
                    <Clock3 className="h-3 w-3" />
                    <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <SectionTitle>Logs</SectionTitle>
        {logs.length ? logs.map((result, index) => (
          <Panel key={terminalTasks[index]}>
            <PanelHeader title={terminalTasks[index]} />
            {result.status === 'rejected' ? <TrellisReadError title="Logs unavailable" message={trellisReadError(result.reason)} /> : <pre className="max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed text-ink-soft">{result.value || 'No output'}</pre>}
          </Panel>
        )) : <Panel>{job.status === 'rejected' && versions.status === 'rejected' ? <TrellisReadError title="Task metadata unavailable" message={trellisReadError(job.reason)} /> : <div className="p-4 text-[13px] text-ink-muted">Task metadata is unavailable for this revision.</div>}</Panel>}
      </div>
    </div>
  )
}
