'use client'

import { useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { Square } from 'lucide-react'
import { stopAllocationDetailAction } from '@/lib/actions/allocation-actions'
import { Button } from '@/components/ui/button'
import { ResourceId } from '@/components/resource-id'
import { InlineNotice } from '@/components/ui/feedback'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function AllocationStopButton({
  serviceId,
  allocationId,
  disabled = false,
}: {
  serviceId: string
  allocationId: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function stop(event: React.MouseEvent) {
    event.preventDefault()
    setStopping(true)
    setError(null)
    try {
      await stopAllocationDetailAction(serviceId, allocationId)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not stop allocation.'))
    } finally {
      setStopping(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(value) => { if (!stopping) { setOpen(value); if (value) setError(null) } }}>
      <AlertDialogTrigger asChild>
        <Button variant="danger" size="sm" type="button" disabled={disabled}>
          <Square />
          Stop
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop allocation <ResourceId value={allocationId} />?</AlertDialogTitle>
          <AlertDialogDescription>
            Stop allocation <ResourceId value={allocationId} />. A replacement may be created if the service still requires this replica.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={stopping}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={stop} disabled={stopping} aria-busy={stopping}>
            {stopping ? 'Stopping…' : 'Stop allocation'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
