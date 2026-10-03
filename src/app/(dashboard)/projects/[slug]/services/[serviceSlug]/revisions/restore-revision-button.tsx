'use client'

import { useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/components/ui/feedback'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { rollbackServiceAction } from '@/lib/actions/services'

export function RestoreRevisionButton({ serviceId, environmentId, deploymentId, image }: { serviceId: string; environmentId: string; deploymentId: string; image: string }) {
  const [pending, startTransition] = useTransition()
  const { toast } = useFeedback()
  return <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="ghost" loading={pending}><RotateCcw />Roll back</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Roll back to {image}?</AlertDialogTitle><AlertDialogDescription>This replaces the service with the exact configuration saved for this deployment.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><Button variant="primary" loading={pending} onClick={() => startTransition(async () => {
    try { await rollbackServiceAction(serviceId, environmentId, deploymentId); toast({ tone: 'success', title: 'Rollback started.' }) }
    catch (reason) { toast({ tone: 'error', title: 'Could not roll back', description: reason instanceof Error ? reason.message : 'The configuration could not be restored.' }) }
  })}>Roll back</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
}
