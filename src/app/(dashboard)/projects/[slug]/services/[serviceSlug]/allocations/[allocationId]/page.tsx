import { redirect, notFound } from 'next/navigation'
import { Info } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectBySlug, getProjectEnvironment, getServiceBySlug, getServiceConfigsWithEnvironments } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { allocationBelongsToService, trellisReadError } from '@/lib/trellis-runtime'
import { getProjectRole } from '@/lib/actions/shared'
import { TrellisReadError } from '@/components/trellis-read-error'
import { NodeLink } from '@/components/node-link'
import { PageHeading, MetaItem } from '@/components/page-heading'
import { Panel, PanelHeader, KeyValue, SectionTitle } from '@/components/ui/panel'
import { AllocationStatus, Chip } from '@/components/status'
import { ExecDialog } from '@/components/exec-dialog'
import { AllocationMetrics } from './allocation-metrics'
import { MetricsHistoryCharts } from '@/components/metrics-history-charts'
import { availableMetricsRanges, metricsRetentionHours } from '@/lib/metrics-series'
import { AllocationStopButton } from './allocation-stop-button'
import { AllocationLogs } from './allocation-logs'
import type { TrellisAllocation } from '@/types/trellis'
import { Time } from '@/components/time'
import { TabsContent } from '@/components/ui/tabs'
import { UrlTabs } from '@/components/url-tabs'
import { InlineNotice } from '@/components/ui/feedback'
import { DeploymentPoller } from '@/components/deployment-poller'
import { allocationFields, allocationNotice, lifecycleEventTitle, lifecycleEventTone } from '@/lib/allocation-lifecycle'
import { Timeline } from '@/components/timeline'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const allocationTabs = [{ value: 'logs', label: 'Logs' }, { value: 'details', label: 'Details' }, { value: 'lifecycle', label: 'Lifecycle' }]

export default async function AllocationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; serviceSlug: string; allocationId: string }>
  searchParams?: Promise<{ tab?: string }>
}) {
  const { slug, serviceSlug, allocationId } = await params
  const { tab } = (await searchParams) ?? {}
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/no-organization')
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
  const [events, metrics, job] = await Promise.allSettled([
    client.getAllocationEvents(allocationId, allocation.namespace),
    client.getAllocationMetrics(allocationId, allocation.namespace),
    client.getJob(allocation.job, allocation.namespace),
  ])
  // Version history has no incarnation identity. Never use it (or a recreated
  // job with a reused revision) to attribute resource limits to this allocation.
  const allocationSpec = allocation.job_incarnation && job.status === 'fulfilled'
    && job.value.incarnation === allocation.job_incarnation && job.value.revision === allocation.job_revision
    ? job.value.spec
    : undefined
  const terminalTasks = allocation.tasks ?? []
  const logTasks = allocation.tasks ?? [undefined]
  const logs = await Promise.allSettled(logTasks.map((task) => client.getAllocationLogs(allocationId, task, allocation.namespace)))
  const history = events.status === 'fulfilled' ? [...events.value].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)) : []
  const notice = allocationNotice(allocation)
  const stoppable = !['stopping', 'stopped', 'lost'].includes(allocation.phase)
  const groupSpec = allocationSpec?.task_groups.find((group) => group.name === allocation.group)
  const cpuLimit = groupSpec?.tasks.reduce((total, task) => total + (task.resources?.cpu ?? 0), 0) ?? 0
  const memoryLimit = groupSpec?.tasks.reduce((total, task) => total + (task.resources?.memory ?? 0), 0) ?? 0
  const explainedLabel = (plain: string, explanation: string) => <TooltipProvider><span className="inline-flex items-center gap-1">{plain}<Tooltip><TooltipTrigger asChild><button type="button" aria-label={`About ${plain}`}><Info className="h-3 w-3" /></button></TooltipTrigger><TooltipContent>{explanation}</TooltipContent></Tooltip></span></TooltipProvider>

  return (
    <div className="space-y-6">
      <DeploymentPoller active={false} />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <PageHeading
            title={allocationId}
            status={<AllocationStatus phase={allocation.phase} health={allocation.health} />}
            meta={
              <>
                <MetaItem label="Service" value={<a className="text-link" href={`/projects/${slug}/services/${serviceSlug}`}>{service.name}</a>} />
                <MetaItem label="Namespace" value={<span className="font-mono text-2xs">{allocation.namespace}</span>} />
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

      {notice ? <InlineNotice tone={notice.tone}><p className="font-medium">{notice.title}</p><p className="mt-0.5 break-words">{notice.text}</p></InlineNotice> : null}

      <UrlTabs tabs={allocationTabs} initial={tab ?? 'logs'} label="Allocation sections">
      <TabsContent value="details" forceMount className="space-y-4 data-[state=inactive]:hidden">
      <SectionTitle>Details</SectionTitle>
      <AllocationMetrics serviceId={service.id} allocationId={allocationId} cpuLimit={cpuLimit} memoryLimit={memoryLimit} initialMetrics={metrics.status === 'fulfilled' ? metrics.value : []} initialError={metrics.status === 'rejected' ? trellisReadError(metrics.reason) : null} />
      <MetricsHistoryCharts serviceId={service.id} environmentId={selectedConfig.environment.id} allocationId={allocationId} ranges={availableMetricsRanges(metricsRetentionHours())} cpuLimit={cpuLimit} memoryLimit={memoryLimit} />

      <Panel id="details" className="scroll-mt-20">
        <PanelHeader title="Allocation details" />
        <div className="p-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 md:grid-cols-4">
            <KeyValue label={explainedLabel('Group', 'A set of tasks that Trellis schedules together.') as never} mono>{allocation.group}</KeyValue>
            <KeyValue label={explainedLabel('Job', 'The Trellis workload definition for this service.') as never} mono>{allocation.job}</KeyValue>
            <KeyValue label="Node" mono><NodeLink id={allocation.node_id} /></KeyValue>
            <KeyValue label="Revision">{allocation.job_revision}</KeyValue>
            <KeyValue label={explainedLabel(allocationFields.generation.label, allocationFields.generation.hint) as never}>{allocation.generation}</KeyValue>
            <KeyValue label={explainedLabel(allocationFields.attempt.label, allocationFields.attempt.hint) as never}>{allocation.attempt}</KeyValue>
            <KeyValue label="Created"><Time value={allocation.created_at} mode="absolute" /></KeyValue>
            <KeyValue label="Last transition"><Time value={allocation.last_transition_at} mode="absolute" /></KeyValue>
          </dl>
          {(allocation.reason || allocation.message || allocation.draining) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {allocation.draining && <Chip tone="warn">Draining</Chip>}
              {allocation.reason && <Chip tone={allocation.phase === 'failed' || allocation.phase === 'lost' ? 'danger' : 'neutral'}>{allocation.reason}</Chip>}
              {allocation.message && <p className="text-sm text-ink-muted">{allocation.message}</p>}
            </div>
          )}
        </div>
      </Panel>
      </TabsContent>
      <TabsContent value="lifecycle" id="lifecycle" forceMount className="space-y-4 data-[state=inactive]:hidden">
        <SectionTitle>Lifecycle</SectionTitle>
        <Panel>
          {events.status === 'rejected' ? <TrellisReadError title="Lifecycle events unavailable" message={trellisReadError(events.reason)} /> : history.length === 0 ? (
            <div className="p-5 text-sm text-ink-muted">No lifecycle events have been recorded.</div>
          ) : (
            <Timeline items={history.map((event, index) => ({ id: `${event.at}-${event.phase}-${index}`, title: lifecycleEventTitle(event, allocation.node_id), titleTooltip: event.reason || event.phase, description: event.message || 'Lifecycle transition', time: <Time value={event.at} mode="absolute" />, tone: lifecycleEventTone(event, index === history.length - 1) }))} />
          )}
        </Panel>
      </TabsContent>
      <TabsContent value="logs" id="logs" forceMount className="space-y-4 data-[state=inactive]:hidden">
        <SectionTitle>Logs</SectionTitle>
        {allocation.tasks === undefined ? <Panel>
          <PanelHeader title="Task logs" />
          {logs[0]?.status === 'rejected' ? <TrellisReadError title="Logs unavailable" message={trellisReadError(logs[0].reason)} /> : <pre className="h-[calc(100dvh-12rem)] min-h-64 overflow-auto p-4 font-mono text-xs leading-relaxed text-ink-soft">{logs[0]?.status === 'fulfilled' && logs[0].value || 'No output'}</pre>}
        </Panel> : logs.length ? <AllocationLogs serviceId={service.id} allocationId={allocationId} tasks={logs.map((result, index) => ({ name: terminalTasks[index], output: result.status === 'fulfilled' ? result.value : '', error: result.status === 'rejected' ? trellisReadError(result.reason) : null }))} /> : <Panel><div className="p-4 text-sm text-ink-muted">No tasks were recorded for this allocation.</div></Panel>}
      </TabsContent>
      </UrlTabs>
    </div>
  )
}
