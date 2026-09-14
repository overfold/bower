'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Square } from 'lucide-react'
import { stopAllocationDetailAction } from '@/lib/actions/allocation-actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
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

  async function stop() {
    setStopping(true)
    setError(null)
    try {
      await stopAllocationDetailAction(serviceId, allocationId)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not stop allocation.')
    } finally {
      setStopping(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setError(null) }}>
      <AlertDialogTrigger asChild>
        <Button variant="danger" size="sm" type="button" disabled={disabled}>
          <Square className="h-3.5 w-3.5" />
          Stop
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop allocation?</AlertDialogTitle>
          <AlertDialogDescription>
            This asks Trellis to stop allocation <span className="font-mono text-ink">{allocationId.slice(0, 8)}</span>. The scheduler may create a replacement if the service still desires this replica.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <div className="mx-5 rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={stopping}>Cancel</AlertDialogCancel>
          <Button variant="danger" type="button" onClick={stop} disabled={stopping}>
            {stopping ? 'Stopping…' : 'Stop allocation'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
