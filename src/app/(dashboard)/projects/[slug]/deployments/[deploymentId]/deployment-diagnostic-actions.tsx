'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Rocket, RotateCcw, Settings2 } from 'lucide-react'
import { deployServiceAction, rollbackServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/components/ui/feedback'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

export function DeploymentDiagnosticActions({ serviceId, environmentId, rollbackTarget, configurationHref }: { serviceId: string; environmentId: string; rollbackTarget?: { id: string; image: string }; configurationHref: string }) {
  const [pending, startTransition] = useTransition()
  const { toast } = useFeedback()
  const rollbackImage = rollbackTarget?.image.split('/').at(-1)

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
    {rollbackTarget ? <AlertDialog><AlertDialogTrigger asChild><Button variant="primary" size="sm" disabled={pending}><RotateCcw />Roll back to {rollbackImage}</Button></AlertDialogTrigger>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Roll back to {rollbackImage}?</AlertDialogTitle><AlertDialogDescription>This replaces the current workload with the exact stored configuration from the selected successful deployment. Current configuration changes are not included.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={() => startTransition(async () => {
          try { await rollbackServiceAction(serviceId, environmentId, rollbackTarget.id); toast({ tone: 'success', title: 'Rollback started.' }) }
          catch (reason) { toast({ tone: 'error', title: 'Could not roll back', description: reason instanceof Error ? reason.message : 'The rollback could not be started.' }) }
        })}>Roll back</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog> : null}
    <Button variant={rollbackTarget ? 'default' : 'primary'} size="sm" loading={pending} onClick={redeploy}><Rocket />Redeploy</Button>
    <Button asChild variant="ghost" size="sm"><Link href={configurationHref}><Settings2 />Edit configuration</Link></Button>
  </div>
}
