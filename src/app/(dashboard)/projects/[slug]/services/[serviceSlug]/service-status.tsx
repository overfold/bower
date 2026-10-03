'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { restartServiceAction } from '@/lib/actions/services'
import { StatusDot } from '@/components/status'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useFeedback } from '@/components/ui/feedback'
import type { TrellisReplacementBackoff } from '@/types/trellis'
import { formatTimestamp } from '@/lib/format'

export function ServiceStatus({ health, ready, replicas, serviceId, environmentId, logsHref, replacementBackoff }: { health: string; ready: number | null; replicas: number; serviceId: string; environmentId: string; logsHref?: string; replacementBackoff: TrellisReplacementBackoff | null }) {
  const [pending, startTransition] = useTransition()
  const { toast } = useFeedback()
  if (!['down', 'degraded'].includes(health)) return <StatusDot status={health} />
  const failures = ready === null ? null : Math.max(0, replicas - ready)
  return <Popover><PopoverTrigger asChild><button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><StatusDot status="failing" /></button></PopoverTrigger><PopoverContent className="w-80 space-y-3 p-4">
    <div><p className="font-medium text-ink">{replacementBackoff ? 'Restart pending' : 'Service unhealthy'}</p><p className="mt-1 text-xs text-ink-muted">{failures === null ? 'Failure count unavailable' : `${failures} ${failures === 1 ? 'replica is' : 'replicas are'} not ready`}</p></div>
    {replacementBackoff ? <div className="space-y-1 text-sm text-ink-soft"><p>{replacementBackoff.message || replacementBackoff.reason || 'Allocation failed'}</p><p><span className="font-medium text-ink">{replacementBackoff.failures}</span> failures · next restart <time dateTime={replacementBackoff.next_replacement_at}>{formatTimestamp(replacementBackoff.next_replacement_at)}</time></p></div> : <p className="text-sm text-ink-soft">No pending restart was reported. Review allocation logs for the latest failure.</p>}
    <div className="flex gap-2"><Button size="sm" loading={pending} onClick={() => startTransition(async () => { try { await restartServiceAction(serviceId, environmentId); toast({ tone: 'success', title: 'Service restart started.' }) } catch (error) { toast({ tone: 'error', title: 'Restart failed', description: error instanceof Error ? error.message : undefined }) } })}>Restart now</Button>{logsHref ? <Button asChild size="sm" variant="ghost"><Link href={logsHref}>View logs</Link></Button> : <Button size="sm" variant="ghost" disabled>Logs unavailable</Button>}</div>
  </PopoverContent></Popover>
}
