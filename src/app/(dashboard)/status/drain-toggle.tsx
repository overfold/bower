'use client'

import { useTransition } from 'react'
import { setNodeDrainAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface DrainToggleProps {
  nodeId: string
  drain: boolean
  allocationCount?: number
}

export function DrainToggle({ nodeId, drain, allocationCount = 0 }: DrainToggleProps) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await setNodeDrainAction(nodeId, !drain)
    })
  }

  if (drain) return <Button size="sm" onClick={handleClick} disabled={isPending} aria-busy={isPending}>{isPending ? 'Resuming…' : 'Resume scheduling'}</Button>

  return <AlertDialog><AlertDialogTrigger asChild><Button variant="danger" size="sm">Drain node</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Drain this node?</AlertDialogTitle><AlertDialogDescription>{allocationCount === 0 ? 'The node will stop accepting new allocations.' : `${allocationCount} allocation${allocationCount === 1 ? '' : 's'} will be moved to other nodes.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClick}>{isPending ? 'Draining…' : 'Drain node'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
}
