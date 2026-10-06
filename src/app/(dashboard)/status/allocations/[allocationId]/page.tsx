import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getManagedProxiesForOrg, getUserOrganization } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { trellisReadError } from '@/lib/trellis-runtime'
import { PageHeading, MetaItem } from '@/components/page-heading'
import { AllocationStatus, Chip } from '@/components/status'
import { Panel, PanelHeader, KeyValue } from '@/components/ui/panel'
import { TrellisReadError } from '@/components/trellis-read-error'
import { NodeLink } from '@/components/node-link'
import { Time } from '@/components/time'
import { Timeline } from '@/components/timeline'
import { DeploymentPoller } from '@/components/deployment-poller'
import { InlineNotice } from '@/components/ui/feedback'
import { allocationFields, allocationNotice, lifecycleEventTitle, lifecycleEventTone } from '@/lib/allocation-lifecycle'
import type { TrellisAllocation, TrellisEvent } from '@/types/trellis'

export default async function SystemAllocationPage({ params }: { params: Promise<{ allocationId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const ctx = await getUserOrganization(user.id)
  if (!ctx) redirect('/no-organization')
  const { allocationId } = await params

  let allocation: TrellisAllocation | undefined
  let isSystemAllocation = false
  let client: Awaited<ReturnType<typeof getTrellisClient>>
  try {
    client = await getTrellisClient(ctx.org.id)
    const [allocations, proxies] = await Promise.all([
      client.listAllocations(),
      getManagedProxiesForOrg(ctx.org.id),
    ])
    allocation = allocations.find((item) => item.id === allocationId)
    isSystemAllocation = Boolean(allocation && proxies.some((entry) => entry.namespace === allocation!.namespace && entry.proxy.trellisJobName === allocation!.job))
  } catch (error) {
    return <Panel><TrellisReadError title="Allocation unavailable" message={trellisReadError(error)} /></Panel>
  }
  if (!allocation || !isSystemAllocation) notFound()

  // Read-only lifecycle: system allocations have no service page to host it.
  const [events] = await Promise.allSettled([client.getAllocationEvents(allocation.id, allocation.namespace)])
  const history: TrellisEvent[] = events.status === 'fulfilled' ? [...events.value].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)) : []
  const notice = allocationNotice(allocation)

  return <div className="space-y-6">
    <DeploymentPoller active={false} />
    <PageHeading
      title={allocation.id}
      status={<AllocationStatus phase={allocation.phase} health={allocation.health} />}
      description="System allocation · read-only"
      meta={<><MetaItem label="Job" value={<span className="font-mono text-2xs">{allocation.job}</span>} /><MetaItem label="Namespace" value={<span className="font-mono text-2xs">{allocation.namespace}</span>} /></>}
    />
    {notice ? <InlineNotice tone={notice.tone}><p className="font-medium">{notice.title}</p><p className="mt-0.5 break-words">{notice.text}</p></InlineNotice> : null}
    <Panel>
      <PanelHeader title="Allocation details" />
      <dl className="grid gap-x-8 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <KeyValue label="Node" mono><NodeLink id={allocation.node_id} /></KeyValue>
        <KeyValue label="Group" mono>{allocation.group || '—'}</KeyValue>
        <KeyValue label="Revision">{allocation.job_revision ?? '—'}</KeyValue>
        <KeyValue label="Created"><Time value={allocation.created_at} mode="absolute" /></KeyValue>
        <KeyValue label="Last transition"><Time value={allocation.last_transition_at} mode="absolute" /></KeyValue>
        <KeyValue label={allocationFields.generation.label}>{allocation.generation ?? '—'}</KeyValue>
        <KeyValue label={allocationFields.attempt.label}>{allocation.attempt ?? '—'}</KeyValue>
      </dl>
      {(allocation.draining || allocation.reason || allocation.message) ? <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
        {allocation.draining ? <Chip tone="warn">Draining</Chip> : null}
        {allocation.reason ? <Chip tone="neutral">{allocation.reason}</Chip> : null}
        {allocation.message ? <p className="text-sm text-ink-muted">{allocation.message}</p> : null}
      </div> : null}
    </Panel>
    <Panel>
      <PanelHeader title="Lifecycle" />
      {events.status === 'rejected' ? <TrellisReadError title="Lifecycle events unavailable" message={trellisReadError(events.reason)} /> : history.length === 0 ? <p className="p-4 text-sm text-ink-muted">No lifecycle events have been recorded.</p> : <Timeline items={history.map((event, index) => ({ id: `${event.at}-${event.phase}-${index}`, title: lifecycleEventTitle(event, allocation.node_id), titleTooltip: event.reason || event.phase, description: event.message || 'Lifecycle transition', time: <Time value={event.at} mode="absolute" />, tone: lifecycleEventTone(event, index === history.length - 1) }))} />}
    </Panel>
  </div>
}
