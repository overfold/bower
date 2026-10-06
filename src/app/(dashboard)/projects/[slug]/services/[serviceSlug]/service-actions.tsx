'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { deployServiceAction, restartServiceAction, rollbackServiceAction } from '@/lib/actions/services'
import { actionErrorMessage } from '@/lib/action-error'
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
import { deploymentImageTag } from '@/lib/format'
import { ConfigDiffPreview } from '@/components/config-diff-preview'
import { DialogBody } from '@/components/ui/dialog'

interface ServiceActionsProps {
  serviceId: string
  serviceName: string
  runningImage: string | null
  environmentId: string
  hasDeployments?: boolean
  changes: ServiceConfigDiff[]
  rollbackTargets: { id: string; image: string; createdAt: string; changes: ServiceConfigDiff[] }[]
}

export function ServiceActions({ serviceId, serviceName, runningImage, environmentId, hasDeployments, changes, rollbackTargets }: ServiceActionsProps) {
  const [deploying, startDeploy] = useTransition()
  const [restarting, startRestart] = useTransition()
  const [rollingBack, startRollback] = useTransition()
  const { toast } = useFeedback()
  const params = useSearchParams()
  const pathname = usePathname()
  const [confirmDeploy, setConfirmDeploy] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState(rollbackTargets[0]?.id ?? '')
  const selectedRollback = rollbackTargets.find((target) => target.id === rollbackTarget)
  useEffect(() => {
    if (params.get('action') !== 'deploy') return
    const frame = requestAnimationFrame(() => {
      setConfirmDeploy(true)
      const url = new URL(window.location.href); url.searchParams.delete('action')
      window.history.replaceState(null, '', `${pathname}${url.search}`)
    })
    return () => cancelAnimationFrame(frame)
  }, [params, pathname])

  function run(action: () => Promise<{ error?: string }>, success: string, failure: string) {
    return async () => {
      try {
        const { error } = await action()
        if (error) toast({ tone: 'danger', title: failure, description: error })
        else toast({ tone: 'success', title: success })
      } catch (reason) {
        toast({ tone: 'danger', title: failure, description: actionErrorMessage(reason, 'The service action could not be completed.') })
      }
    }
  }

  return (
    <div className="flex items-center gap-2">
      {hasDeployments && rollbackTargets.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="default" size="sm" loading={rollingBack}>
              <RotateCcw />
              Roll back…
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="gap-0">
            <AlertDialogHeader>
              <AlertDialogTitle>Roll back {serviceName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Choose an earlier successful release. The selected release will become the running configuration.
                {runningImage ? <span className="mt-1 block">Running <span className="font-mono text-ink">{deploymentImageTag(runningImage)}</span></span> : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <DialogBody className="px-0 py-0 sm:px-0"><div className="space-y-2 px-4 py-4 sm:px-5"><label className="text-sm font-medium text-ink" htmlFor="service-rollback-release">Release</label><Select value={rollbackTarget} onValueChange={setRollbackTarget}><SelectTrigger id="service-rollback-release" aria-label="Rollback release" className="font-mono"><SelectValue /></SelectTrigger><SelectContent>{rollbackTargets.map((target) => <SelectItem key={target.id} value={target.id}><span className="font-mono">{deploymentImageTag(target.image)}</span><span className="ml-2 font-sans text-xs text-ink-muted"><Time value={target.createdAt} /></span></SelectItem>)}</SelectContent></Select></div><ConfigDiffPreview changes={selectedRollback?.changes ?? []} afterLabel="Selected release" flush /></DialogBody>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button variant="primary" loading={rollingBack} disabled={!rollbackTarget} onClick={() => startRollback(run(() => rollbackServiceAction(serviceId, environmentId, rollbackTarget), 'Rollback started', 'Rollback failed'))}>
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
        onClick={() => startRestart(run(() => restartServiceAction(serviceId, environmentId), 'Service restart started', 'Restart failed'))}
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
        <AlertDialogContent size="lg" className={changes.length ? "gap-0" : undefined}>
          <AlertDialogHeader><AlertDialogTitle>Deploy this service?</AlertDialogTitle><AlertDialogDescription>{changes.length ? 'Review the saved changes that will be deployed.' : 'The saved configuration matches the currently running release.'}</AlertDialogDescription></AlertDialogHeader>
          {changes.length ? <DialogBody className="px-0 py-0 sm:px-0"><ConfigDiffPreview changes={changes} afterLabel="After deploy" flush /></DialogBody> : null}
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><Button variant="primary" loading={deploying} onClick={() => startDeploy(async () => { await run(() => deployServiceAction(serviceId, environmentId), 'Deployment started', 'Deploy failed')(); setConfirmDeploy(false) })}>Deploy</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
