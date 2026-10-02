'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { deployServiceAction, restartServiceAction, rollbackServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Rocket, RefreshCw, RotateCcw } from 'lucide-react'
import { useFeedback } from '@/components/ui/feedback'

interface ServiceActionsProps {
  serviceId: string
  environmentId: string
  hasDeployments?: boolean
}

export function ServiceActions({ serviceId, environmentId, hasDeployments }: ServiceActionsProps) {
  const [deploying, startDeploy] = useTransition()
  const [restarting, startRestart] = useTransition()
  const [rollingBack, startRollback] = useTransition()
  const { toast } = useFeedback()
  const params = useSearchParams()
  const pathname = usePathname()
  const [confirmDeploy, setConfirmDeploy] = useState(false)
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
      {hasDeployments && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" loading={rollingBack}>
              <RotateCcw />
              Roll back
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Roll back service?</AlertDialogTitle>
              <AlertDialogDescription>
                This re-applies the exact previous runtime configuration and records its image as the active release.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => startRollback(run(() => rollbackServiceAction(serviceId, environmentId), 'Rollback started.'))}>
                Roll back
              </AlertDialogAction>
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
        variant="primary"
        size="sm"
        disabled={deploying}
        aria-busy={deploying}
        onClick={() => startDeploy(run(() => deployServiceAction(serviceId, environmentId), 'Deployment started.'))}
      >
        <Rocket />
        {deploying ? 'Deploying...' : 'Deploy'}
      </Button>
      <AlertDialog open={confirmDeploy} onOpenChange={setConfirmDeploy}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Deploy this service?</AlertDialogTitle><AlertDialogDescription>Deploy the currently saved configuration. Review changes before continuing.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><Button variant="primary" loading={deploying} onClick={() => startDeploy(async () => { await run(() => deployServiceAction(serviceId, environmentId), 'Deployment started.')(); setConfirmDeploy(false) })}>Deploy</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
