'use client'

import { useState, useTransition } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, ShieldMinus, UserMinus } from 'lucide-react'
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
} from '@/components/ui/alert-dialog'
import { toggleInstanceAdminAction } from '@/lib/actions/settings'
import { removeOrganizationMemberAction } from '@/lib/actions/settings'
import { InlineNotice } from '@/components/ui/feedback'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function MemberActionsMenu({
  membershipId,
  memberName,
  email,
  canRemoveInstanceAdmin,
  canRemoveFromOrganization,
}: {
  membershipId: string
  memberName: string
  email: string
  canRemoveInstanceAdmin: boolean
  canRemoveFromOrganization: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<'instance' | 'organization' | null>(null)

  if (!canRemoveInstanceAdmin && !canRemoveFromOrganization) return null

  function handleRemove(event: React.MouseEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const result = action === 'instance'
          ? await toggleInstanceAdminAction(email, false)
          : await removeOrganizationMemberAction(membershipId)
        if (result.error) {
          setError(result.error)
          return
        }
        setOpen(false)
        setAction(null)
        router.refresh()
      } catch (err) {
        setError(actionErrorMessage(err, 'Could not remove administrator.'))
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!isPending) { setOpen(next); if (!next) setAction(null); setError(null) } }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isPending} aria-label={`Actions for ${memberName}`}>
            <MoreHorizontal className="h-4 w-4 text-ink-muted" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {canRemoveInstanceAdmin ? <DropdownMenuItem onSelect={() => { setAction('instance'); setOpen(true) }}><ShieldMinus className="mr-2 h-4 w-4" />Remove instance admin</DropdownMenuItem> : null}
          {canRemoveFromOrganization ? <DropdownMenuItem className="text-danger-600" onSelect={() => { setAction('organization'); setOpen(true) }}><UserMinus className="mr-2 h-4 w-4" />Remove from organization</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{action === 'instance' ? `Remove ${memberName} as instance administrator?` : `Remove ${memberName} from the organization?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {action === 'instance'
              ? <><span className="block">{email}</span>This revokes instance-wide administrative access. Their organization membership is unchanged.</>
              : <><span className="block">{email}</span>This removes them from this organization and revokes access granted by its teams. This does not delete their account.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRemove} disabled={isPending} aria-busy={isPending}>
            {isPending ? 'Removing…' : action === 'instance' ? 'Remove instance admin' : 'Remove from organization'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
