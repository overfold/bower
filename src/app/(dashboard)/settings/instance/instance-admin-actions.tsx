'use client'

import { useTransition } from 'react'
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

  if (adminId === currentUserId) return null

  function handleRemove() {
    startTransition(async () => {
      await toggleInstanceAdminAction(email, false)
      router.refresh()
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending} aria-label="Remove administrator">
          <Trash2 className="h-4 w-4 text-ink-muted" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove instance administrator</AlertDialogTitle>
          <AlertDialogDescription>
            This will revoke instance admin privileges for {email}. They will lose access to instance-level settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRemove} disabled={isPending}>
            {isPending ? 'Removing...' : 'Remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
