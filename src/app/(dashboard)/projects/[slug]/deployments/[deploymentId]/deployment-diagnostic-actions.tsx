'use client'

import { useTransition } from 'react'
import { Rocket, RotateCcw } from 'lucide-react'
import { deployServiceAction, rollbackServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/components/ui/feedback'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

export function DeploymentDiagnosticActions({ serviceId, environmentId, rollbackTarget }: { serviceId: string; environmentId: string; rollbackTarget?: { id: string; image: string } }) {
  const [pending, startTransition] = useTransition()
  const { toast } = useFeedback()

  function redeploy() {
    startTransition(async () => {
      try {
        await deployServiceAction(serviceId, environmentId)
        toast({ tone: 'success', title: 'Redeployment started.' })
      } catch (reason) {
        toast({ tone: 'error', title: 'Could not redeploy', description: reason instanceof Error ? reason.message : 'The deployment could not be started.' })
      }
    })
  }

  return <div className="flex flex-wrap gap-2">
    <Button variant="primary" size="sm" loading={pending} onClick={redeploy}><Rocket />Redeploy</Button>
    {rollbackTarget ? <AlertDialog><AlertDialogTrigger asChild><Button variant="default" size="sm" disabled={pending}><RotateCcw />Roll back to this</Button></AlertDialogTrigger>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Roll back to this deployment?</AlertDialogTitle><AlertDialogDescription>This replaces the current workload with the exact stored configuration for {rollbackTarget.image}. Current configuration changes are not included.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={() => startTransition(async () => {
          try { await rollbackServiceAction(serviceId, environmentId, rollbackTarget.id); toast({ tone: 'success', title: 'Rollback started.' }) }
          catch (reason) { toast({ tone: 'error', title: 'Could not roll back', description: reason instanceof Error ? reason.message : 'The rollback could not be started.' }) }
        })}>Roll back</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog> : null}
  </div>
}
