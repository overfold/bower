'use client'

import Link from 'next/link'
import { Info } from 'lucide-react'
import { useTransition } from 'react'
import { restartServiceAction } from '@/lib/actions/services'
import { actionErrorMessage } from '@/lib/action-error'
import { StatusDot, Chip, Dot } from '@/components/status'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useFeedback } from '@/components/ui/feedback'
import { RestartCountdown } from '@/components/restart-countdown'
import type { TrellisReplacementBackoff } from '@/types/trellis'

export function ServiceStatus({ health, ready, replicas, serviceId, environmentId, logsHref, replacementBackoff, canDeploy = false, cause }: { health: string; ready: number | null; replicas: number; serviceId: string; environmentId: string; logsHref?: string; replacementBackoff: TrellisReplacementBackoff | null; /** Viewers can read the cause but cannot restart the service. */ canDeploy?: boolean; /** The cause when no restart backoff names one, such as an allocation stuck waiting for placement. */ cause?: string | null }) {
  const [pending, startTransition] = useTransition()
  const { toast } = useFeedback()
  if (!['down', 'degraded'].includes(health)) return <StatusDot status={health} />
  const failures = ready === null ? null : Math.max(0, replicas - ready)
  return <Popover><PopoverTrigger asChild><button type="button" aria-haspopup="dialog" className="group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Chip tone="danger" className="transition-colors group-hover:bg-danger-200"><Dot tone="danger" />Failing<Info className="size-3" aria-hidden="true" /></Chip></button></PopoverTrigger><PopoverContent className="w-80 space-y-3 p-4">
    <div><p className="font-medium text-ink">Failing</p>{replacementBackoff ? <p className="mt-1 text-xs text-ink-muted">Restart pending · <RestartCountdown at={replacementBackoff.next_replacement_at} /></p> : null}<p className="mt-1 text-xs text-ink-muted">{failures === null ? 'Failure count unavailable' : `${failures} ${failures === 1 ? 'replica is' : 'replicas are'} not ready`}</p></div>
    {replacementBackoff ? <div className="space-y-1 text-sm text-ink-soft"><p>{replacementBackoff.message || replacementBackoff.reason || 'Allocation failed'}</p><p><span className="font-medium text-ink">{replacementBackoff.failures}</span> failures</p></div> : <p className="text-sm text-ink-soft">{cause ?? 'No pending restart was reported. Review allocation logs for the latest failure.'}</p>}
    <div className="flex gap-2">{canDeploy ? <Button size="sm" loading={pending} onClick={() => startTransition(async () => { try { const { error } = await restartServiceAction(serviceId, environmentId); if (error) toast({ tone: 'danger', title: 'Restart failed', description: error }); else toast({ tone: 'success', title: 'Service restart started' }) } catch (reason) { toast({ tone: 'danger', title: 'Restart failed', description: actionErrorMessage(reason, 'The service could not be restarted.') }) } })}>Restart now</Button> : null}{logsHref ? <Button asChild size="sm" variant="ghost"><Link href={logsHref}>View logs</Link></Button> : <Button size="sm" variant="ghost" disabled>Logs unavailable</Button>}</div>
  </PopoverContent></Popover>
}
