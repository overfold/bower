'use client'

import { useState, useTransition } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { toggleInstanceAdminAction } from '@/lib/actions/settings'
import { InlineNotice } from '@/components/ui/feedback'

export function RemoveInstanceAdminButton({
  email,
  adminId,
  currentUserId,
}: {
  email: string
  adminId: string
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (adminId === currentUserId) return null

  function handleRemove(event: React.MouseEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const result = await toggleInstanceAdminAction(email, false)
        if (result.error) {
          setError(result.error)
          return
        }
        setOpen(false)
        router.refresh()
      } catch (err) {
        setError(actionErrorMessage(err, 'Could not remove administrator.'))
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!isPending) { setOpen(next); if (next) setError(null) } }}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending} aria-label={`Remove administrator ${email}`}>
          <Trash2 className="h-4 w-4 text-ink-muted" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {email} as instance administrator?</AlertDialogTitle>
          <AlertDialogDescription>
            This will revoke instance admin privileges for {email}. They will lose access to instance-level settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRemove} disabled={isPending} aria-busy={isPending}>
            {isPending ? 'Removing…' : 'Remove administrator'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
