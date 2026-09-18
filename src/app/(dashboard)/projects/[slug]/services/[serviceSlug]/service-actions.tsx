'use client'

import { useTransition } from 'react'
import { deployServiceAction, restartServiceAction, rollbackServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Rocket, RefreshCw, RotateCcw } from 'lucide-react'

interface ServiceActionsProps {
  serviceId: string
  environmentId: string
  hasDeployments?: boolean
}

export function ServiceActions({ serviceId, environmentId, hasDeployments }: ServiceActionsProps) {
  const [deploying, startDeploy] = useTransition()
  const [restarting, startRestart] = useTransition()
  const [rollingBack, startRollback] = useTransition()

  return (
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
              <AlertDialogAction onClick={() => startRollback(() => rollbackServiceAction(serviceId, environmentId))}>
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
        onClick={() => startRestart(() => restartServiceAction(serviceId, environmentId))}
      >
        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${restarting ? 'animate-spin' : ''}`} />
        Restart
      </Button>
      <Button
        variant="primary"
        size="sm"
        disabled={deploying}
        onClick={() => startDeploy(() => deployServiceAction(serviceId, environmentId))}
      >
        <Rocket className="mr-1.5 h-3.5 w-3.5" />
        {deploying ? 'Deploying...' : 'Deploy'}
      </Button>
    </div>
  )
}
