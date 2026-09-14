'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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

export function AddInstanceAdminDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setOpen(false)
    setError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = (formData.get('email') as string)?.trim()
    if (!email) return

    startTransition(async () => {
      const result = await toggleInstanceAdminAction(email, true)
      if (result?.error) {
        setError(result.error)
      } else {
        handleClose()
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Add admin
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add instance administrator</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email address</Label>
              <Input
                id="admin-email"
                name="email"
                type="email"
                placeholder="user@example.com"
                required
              />
            </div>
            {error ? (
              <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" size="sm" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add administrator'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
