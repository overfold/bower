'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { deployServiceAction, restartServiceAction, rollbackServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Rocket, RefreshCw, RotateCcw } from 'lucide-react'
import { useFeedback } from '@/components/ui/feedback'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ServiceConfigDiff } from '@/lib/service-config-diff'
import { Time } from '@/components/time'

interface ServiceActionsProps {
  serviceId: string
  environmentId: string
  hasDeployments?: boolean
  changes: ServiceConfigDiff[]
  rollbackTargets: { id: string; image: string; createdAt: string }[]
}

export function ServiceActions({ serviceId, environmentId, hasDeployments, changes, rollbackTargets }: ServiceActionsProps) {
  const [deploying, startDeploy] = useTransition()
  const [restarting, startRestart] = useTransition()
  const [rollingBack, startRollback] = useTransition()
  const { toast } = useFeedback()
  const params = useSearchParams()
  const pathname = usePathname()
  const [confirmDeploy, setConfirmDeploy] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState(rollbackTargets[0]?.id ?? '')
  useEffect(() => {
    if (params.get('action') !== 'deploy') return
    const frame = requestAnimationFrame(() => setConfirmDeploy(true))
    const url = new URL(window.location.href); url.searchParams.delete('action')
    window.history.replaceState(null, '', `${pathname}${url.search}`)
    return () => cancelAnimationFrame(frame)
  }, [params, pathname])

  function run(action: () => Promise<void>, success: string) {
    return async () => {
      try {
        await action()
        toast({ tone: 'success', title: success })
      } catch (reason) {
        toast({ tone: 'error', title: 'Service action failed', description: reason instanceof Error ? reason.message : 'The service action could not be completed.' })
      }
    }
  }

  return (
    <div className="flex items-center gap-2">
      {hasDeployments && rollbackTargets.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" loading={rollingBack}>
              <RotateCcw />
              Roll back to…
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Roll back service?</AlertDialogTitle>
              <AlertDialogDescription>
                Choose an earlier successful release. This re-applies its exact runtime configuration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-5"><Select value={rollbackTarget} onValueChange={setRollbackTarget}><SelectTrigger aria-label="Rollback release"><SelectValue /></SelectTrigger><SelectContent>{rollbackTargets.map((target) => <SelectItem key={target.id} value={target.id}>{target.image} · <Time value={target.createdAt} /></SelectItem>)}</SelectContent></Select></div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button variant="primary" loading={rollingBack} disabled={!rollbackTarget} onClick={() => startRollback(run(() => rollbackServiceAction(serviceId, environmentId, rollbackTarget), 'Rollback started.'))}>
                Roll back
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <Button
        variant="default"
        size="sm"
        disabled={restarting}
        aria-busy={restarting}
        onClick={() => startRestart(run(() => restartServiceAction(serviceId, environmentId), 'Service restart started.'))}
      >
        <RefreshCw className={restarting ? 'animate-spin' : undefined} />
        Restart
      </Button>
      <Button
        variant={changes.length ? 'primary' : 'default'}
        size="sm"
        disabled={deploying}
        aria-busy={deploying}
        onClick={() => setConfirmDeploy(true)}
      >
        <Rocket />
        {deploying ? 'Deploying...' : 'Deploy'}
      </Button>
      <AlertDialog open={confirmDeploy} onOpenChange={setConfirmDeploy}>
        <AlertDialogContent size="lg">
          <AlertDialogHeader><AlertDialogTitle>Deploy this service?</AlertDialogTitle><AlertDialogDescription>{changes.length ? 'Review the saved changes that will be deployed.' : 'The saved configuration matches the currently running release.'}</AlertDialogDescription></AlertDialogHeader>
          {changes.length ? <div className="mx-5 overflow-hidden rounded-md border border-line">{changes.map((change) => <div key={change.key} className="grid grid-cols-[7rem_1fr] gap-3 border-b border-line px-3 py-2 text-sm last:border-0"><span className="font-medium text-ink">{change.label}</span><span className="min-w-0 break-all font-mono text-xs text-ink-muted">{change.before} <span aria-hidden="true">→</span> <span className="text-ink">{change.after}</span></span></div>)}</div> : null}
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><Button variant="primary" loading={deploying} onClick={() => startDeploy(async () => { await run(() => deployServiceAction(serviceId, environmentId), 'Deployment started.')(); setConfirmDeploy(false) })}>Deploy</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
