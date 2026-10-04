'use client'

import { useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/components/ui/feedback'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { rollbackServiceAction } from '@/lib/actions/services'
import { actionErrorMessage } from '@/lib/action-error'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function RestoreRevisionButton({ serviceId, environmentId, deploymentId, image }: { serviceId: string; environmentId: string; deploymentId: string; image: string }) {
  const [pending, startTransition] = useTransition()
  const { toast } = useFeedback()
  return <AlertDialog><TooltipProvider><Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button size="icon" variant="ghost" loading={pending} aria-label="Roll back to this release"><RotateCcw /></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Roll back to this release</TooltipContent></Tooltip></TooltipProvider><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Roll back to <span className="font-mono">{image}</span>?</AlertDialogTitle><AlertDialogDescription>This replaces the service with the exact configuration saved for this deployment.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><Button variant="primary" loading={pending} onClick={() => startTransition(async () => {
    try {
      const { error } = await rollbackServiceAction(serviceId, environmentId, deploymentId)
      if (error) toast({ tone: 'danger', title: 'Could not roll back', description: error })
      else toast({ tone: 'success', title: 'Rollback started' })
    } catch (reason) { toast({ tone: 'danger', title: 'Could not roll back', description: actionErrorMessage(reason, 'The configuration could not be restored.') }) }
  })}>Roll back</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
}
