'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { RestartCountdown } from '@/components/restart-countdown'
import type { ServiceFailure } from '@/lib/service-failure'
import { formatCpu } from '@/lib/format'
import type { Tone } from '@/lib/tone'

/** Shared failure anatomy for services and allocations: cause, context, applicable actions. */
export function FailureNotice({ tone = 'danger', title, detail, action }: { tone?: Tone; title: string; detail?: React.ReactNode; action?: React.ReactNode }) {
  return <InlineNotice tone={tone} action={action}>
    <p className="break-words font-medium">{title}</p>
    {detail ? <div className="mt-0.5 text-xs text-ink-muted">{detail}</div> : null}
  </InlineNotice>
}

function RestartFailureAction({ serviceId, environmentId }: { serviceId: string; environmentId: string }) {
  const [pending, startTransition] = useTransition()
  const { toast } = useFeedback()
  return <Button size="sm" loading={pending} onClick={() => startTransition(async () => {
    try {
      const { restartServiceAction } = await import('@/lib/actions/services')
      const result = await restartServiceAction(serviceId, environmentId)
      if (result.error) throw new Error(result.error)
      toast({ tone: 'success', title: 'Service restart started' })
    } catch (reason) { toast({ tone: 'danger', title: 'Restart failed', description: actionErrorMessage(reason, 'The service could not be restarted.') }) }
  })}>Restart now</Button>
}

/** One body notice holds the service's cause, recovery context, and actions. */
export function ServiceFailureNotice({ failure, logsHref, serviceId, environmentId, canDeploy, ready, replicas, cpu, configurationHref, capacityBlocked = false }: { failure: ServiceFailure; logsHref?: string; serviceId?: string; environmentId?: string; canDeploy?: boolean; ready?: number; replicas?: number; cpu?: number; configurationHref?: string; capacityBlocked?: boolean }) {
  return <FailureNotice title={capacityBlocked ? 'No node has room for this service' : failure.cause} action={<div className="flex flex-wrap gap-2">
    {capacityBlocked ? <>
      {configurationHref ? <Button asChild size="sm"><Link href={`${configurationHref}#resources`}>Edit resources</Link></Button> : null}
      <Button asChild size="sm" variant="ghost"><Link href="/status">View cluster status</Link></Button>
    </> : <>
      {canDeploy && serviceId && environmentId ? <RestartFailureAction serviceId={serviceId} environmentId={environmentId} /> : null}
      {logsHref ? <Button asChild size="sm" variant="ghost"><Link href={logsHref}>View logs</Link></Button> : null}
    </>}
  </div>} detail={<>
    {capacityBlocked ? <p>Each replica asks for {formatCpu(cpu ?? 0)}. Lower the request or free up capacity on the cluster.</p> : null}
    <p>
      {failure.failures != null ? <>{failure.failures} {failure.failures === 1 ? 'failure' : 'failures'} · </> : null}
      {failure.nextAttemptAt ? <>Next restart <RestartCountdown at={failure.nextAttemptAt} bare /> · </> : null}
      {ready != null && replicas != null ? <>{ready} of {replicas} replicas ready</> : null}
    </p>
  </>} />
}
