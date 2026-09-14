'use client'

import { useState, useTransition } from 'react'
import { deployServiceAction, restartServiceAction, promoteServiceAction, rollbackServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Rocket, RefreshCw, ArrowUpCircle, RotateCcw } from 'lucide-react'

interface ServiceActionsProps {
  serviceId: string
  environmentId: string
  isLocked: boolean
  replicas?: number
  canPromote?: boolean
  promotionTargets?: { id: string; name: string }[]
  hasDeployments?: boolean
}

export function ServiceActions({ serviceId, environmentId, isLocked, canPromote, promotionTargets, hasDeployments }: ServiceActionsProps) {
  const [deploying, startDeploy] = useTransition()
  const [restarting, startRestart] = useTransition()
  const [promoting, startPromote] = useTransition()
  const [rollingBack, startRollback] = useTransition()
  const [promoteTarget, setPromoteTarget] = useState<string>('')

  return (
    <div className="flex items-center gap-2">
      {hasDeployments && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isLocked || rollingBack}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Rollback
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rollback deployment?</AlertDialogTitle>
              <AlertDialogDescription>
                This re-applies the previous JobSpec in this environment. It does not change the service definition used by future deployments.
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
      {canPromote && promotionTargets && promotionTargets.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isLocked || promoting}>
              <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5" />
              Promote
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Promote to another environment?</AlertDialogTitle>
              <AlertDialogDescription>
                This deploys the current service definition to the target environment. The target keeps its own replica count, variables, and secret bindings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-6 pb-2">
              <Select value={promoteTarget} onValueChange={setPromoteTarget}>
                <SelectTrigger><SelectValue placeholder="Select target environment" /></SelectTrigger>
                <SelectContent>
                  {promotionTargets.map((env) => (
                    <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={!promoteTarget}
                onClick={() => startPromote(() => promoteServiceAction(serviceId, environmentId, promoteTarget))}
              >
                Promote
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <Button
        variant="default"
        size="sm"
        disabled={isLocked || restarting}
        onClick={() => startRestart(() => restartServiceAction(serviceId, environmentId))}
      >
        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${restarting ? 'animate-spin' : ''}`} />
        Restart
      </Button>
      <Button
        variant="primary"
        size="sm"
        disabled={isLocked || deploying}
        onClick={() => startDeploy(() => deployServiceAction(serviceId, environmentId))}
      >
        <Rocket className="mr-1.5 h-3.5 w-3.5" />
        {deploying ? 'Deploying...' : 'Deploy'}
      </Button>
    </div>
  )
}
