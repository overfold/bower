'use client'

import { useTransition } from 'react'
import { setNodeDrainAction } from '@/lib/actions/operations'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { RowActions, RowActionItem } from '@/components/ui/row-actions'

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

  const action = drain ? 'Resume scheduling' : 'Drain node'
  return <AlertDialog><RowActions name={nodeId}><AlertDialogTrigger asChild><RowActionItem disabled={isPending}>{action}</RowActionItem></AlertDialogTrigger></RowActions><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{drain ? 'Resume scheduling on this node?' : 'Drain this node?'}</AlertDialogTitle><AlertDialogDescription>{drain ? 'The node will be eligible to accept new allocations.' : allocationCount === 0 ? 'The node will stop accepting new allocations.' : `${allocationCount} allocation${allocationCount === 1 ? '' : 's'} will be moved to other nodes.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClick}>{isPending ? (drain ? 'Resuming…' : 'Draining…') : action}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
}
