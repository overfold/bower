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
import type { TrellisAllocation } from '@/types/trellis'

export default async function SystemAllocationPage({ params }: { params: Promise<{ allocationId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const ctx = await getUserOrganization(user.id)
  if (!ctx) redirect('/login')
  const { allocationId } = await params

  let allocation: TrellisAllocation | undefined
  let isSystemAllocation = false
  try {
    const [allocations, proxies] = await Promise.all([
      (await getTrellisClient(ctx.org.id)).listAllocations(),
      getManagedProxiesForOrg(ctx.org.id),
    ])
    allocation = allocations.find((item) => item.id === allocationId)
    isSystemAllocation = Boolean(allocation && proxies.some((entry) => entry.namespace === allocation!.namespace && entry.proxy.trellisJobName === allocation!.job))
  } catch (error) {
    return <Panel><TrellisReadError title="Allocation unavailable" message={trellisReadError(error)} /></Panel>
  }
  if (!allocation || !isSystemAllocation) notFound()

  return <div className="space-y-6">
    <PageHeading
      title={allocation.id}
      status={<AllocationStatus phase={allocation.phase} health={allocation.health} />}
      description="System allocation · read-only"
      meta={<><MetaItem label="Job" value={<span className="font-mono text-2xs">{allocation.job}</span>} /><MetaItem label="Namespace" value={<span className="font-mono text-2xs">{allocation.namespace}</span>} /></>}
    />
    <Panel>
      <PanelHeader title="Allocation details" />
      <dl className="grid gap-x-8 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <KeyValue label="Node" mono><NodeLink id={allocation.node_id} /></KeyValue>
        <KeyValue label="Group" mono>{allocation.group || '—'}</KeyValue>
        <KeyValue label="Revision">{allocation.job_revision ?? '—'}</KeyValue>
        <KeyValue label="Created"><Time value={allocation.created_at} mode="absolute" /></KeyValue>
        <KeyValue label="Last transition"><Time value={allocation.last_transition_at} mode="absolute" /></KeyValue>
        <KeyValue label="Generation">{allocation.generation ?? '—'}</KeyValue>
        <KeyValue label="Attempt">{allocation.attempt ?? '—'}</KeyValue>
      </dl>
      {(allocation.draining || allocation.reason || allocation.message) ? <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
        {allocation.draining ? <Chip tone="warn">Draining</Chip> : null}
        {allocation.reason ? <Chip tone="neutral">{allocation.reason}</Chip> : null}
        {allocation.message ? <p className="text-sm text-ink-muted">{allocation.message}</p> : null}
      </div> : null}
    </Panel>
  </div>
}
