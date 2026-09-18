import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock3 } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getServiceBySlug, getServiceConfigsWithEnvironments } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { PageHeading, MetaItem } from '@/components/page-heading'
import { Panel, PanelHeader, KeyValue, SectionTitle } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { Chip, StatusDot } from '@/components/status'
import { ExecDialog } from '@/components/exec-dialog'
import { AllocationMetrics } from './allocation-metrics'
import { AllocationStopButton } from './allocation-stop-button'
import type { TrellisAllocation, TrellisEvent } from '@/types/trellis'

function eventHistory(allocation: TrellisAllocation, events: TrellisEvent[]) {
  const result = [...events]
  const createdAt = Date.parse(allocation.created_at)
  const hasCreatedEvent = result.some((event) => Math.abs(Date.parse(event.at) - createdAt) < 1000)
  if (!hasCreatedEvent) {
    result.push({ phase: 'placed', message: 'Allocation created and placed.', at: allocation.created_at })
  }
  return result.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

export default async function AllocationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; serviceSlug: string; allocationId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug, serviceSlug, allocationId } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')
  const project = await getProjectBySlug(orgCtx.org.id, slug)
  if (!project) notFound()
  const service = await getServiceBySlug(project.id, serviceSlug)
  if (!service) notFound()

  const configs = await getServiceConfigsWithEnvironments(service.id)
  const { env } = await searchParams
  const environmentId = typeof env === 'string' ? env : null
  const selectedConfig = environmentId ? configs.find(({ environment }) => environment.id === environmentId) : null
  if (!selectedConfig) notFound()
  const client = await getTrellisClient(orgCtx.org.id)
  let allocation: TrellisAllocation | null = null

  try {
    const allocs = await client.listAllocations({ namespace: selectedConfig.environment.trellisNamespace })
    const knownJobs = new Set([service.slug, selectedConfig.config.activeJobName].filter((value): value is string => Boolean(value)))
    allocation = allocs.find((item) => {
      if (item.id !== allocationId) return false
      return item.labels?.['bower/service'] === service.slug || knownJobs.has(item.job)
    }) ?? null
  } catch {
    notFound()
  }
  if (!allocation) notFound()

  const matchingConfig = configs.find(({ environment }) => environment.trellisNamespace === allocation?.namespace)
  const [events, metrics, revisions] = await Promise.all([
    client.getAllocationEvents(allocationId).catch(() => []),
    client.getAllocationMetrics(allocationId).catch(() => []),
    client.getJobRevisions(allocation.job, allocation.namespace).catch(() => []),
  ])
  const allocationSpec = revisions.find((revision) => revision.revision === allocation.job_revision)?.spec
  const terminalTasks = allocationSpec?.task_groups
    .find((group) => group.name === allocation.group)
    ?.tasks.map((task) => task.name) ?? []
  const logs = await Promise.all(terminalTasks.map(async (task) => ({ task, output: await client.getAllocationLogs(allocationId, task).catch(() => '') })))
  const history = eventHistory(allocation, events)
  const stoppable = !['stopping', 'stopped', 'lost'].includes(allocation.phase)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href={`/projects/${slug}/services/${serviceSlug}?env=${encodeURIComponent(selectedConfig.environment.id)}`} className="mt-2 text-ink-muted transition-colors hover:text-ink" aria-label="Back to service">
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

      <AllocationMetrics serviceId={service.id} allocationId={allocationId} initialMetrics={metrics} />

      <Panel>
        <PanelHeader title="Allocation details" />
        <div className="p-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 md:grid-cols-4">
            <KeyValue label="Group" mono>{allocation.group}</KeyValue>
            <KeyValue label="Job" mono>{allocation.job}</KeyValue>
            <KeyValue label="Node" mono>{allocation.node_id}</KeyValue>
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
          {history.length === 0 ? (
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
        {logs.length ? logs.map(({ task, output }) => (
          <Panel key={task}>
            <PanelHeader title={task} />
            <pre className="max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed text-ink-soft">{output || 'No output'}</pre>
          </Panel>
        )) : <Panel><div className="p-4 text-[13px] text-ink-muted">Task metadata is unavailable for this revision.</div></Panel>}
      </div>
    </div>
  )
}
