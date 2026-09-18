'use client'

import { useState, useTransition } from 'react'
import { deployServiceAction, restartServiceAction, rollbackServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Rocket, RefreshCw, RotateCcw } from 'lucide-react'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'

interface ServiceActionsProps {
  serviceId: string
  environmentId: string
  hasDeployments?: boolean
}

export function ServiceActions({ serviceId, environmentId, hasDeployments }: ServiceActionsProps) {
  const [deploying, startDeploy] = useTransition()
  const [restarting, startRestart] = useTransition()
  const [rollingBack, startRollback] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { toast } = useFeedback()

  function run(action: () => Promise<void>, success: string) {
    setError(null)
    return async () => {
      try {
        await action()
        toast({ tone: 'success', title: success })
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'The service action could not be completed.')
      }
    }
  }

  return (
    <div className="space-y-2">
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
    <div className="flex items-center gap-2">
      {hasDeployments && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={rollingBack}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Rollback
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rollback service?</AlertDialogTitle>
              <AlertDialogDescription>
                This re-applies the exact previous runtime configuration and records its image as the active release.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => startRollback(run(() => rollbackServiceAction(serviceId, environmentId), 'Rollback started.'))}>
                Rollback
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <Button
        variant="default"
        size="sm"
        disabled={restarting}
        onClick={() => startRestart(run(() => restartServiceAction(serviceId, environmentId), 'Service restart started.'))}
      >
        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${restarting ? 'animate-spin' : ''}`} />
        Restart
      </Button>
      <Button
        variant="primary"
        size="sm"
        disabled={deploying}
        onClick={() => startDeploy(run(() => deployServiceAction(serviceId, environmentId), 'Deployment started.'))}
      >
        <Rocket className="mr-1.5 h-3.5 w-3.5" />
        {deploying ? 'Deploying...' : 'Deploy'}
      </Button>
      </div>
    </div>
  )
}
