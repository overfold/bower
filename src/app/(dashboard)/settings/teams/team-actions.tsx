'use client'

import { useState, useTransition } from 'react'
import { createTeamAction, deleteTeamAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2 } from 'lucide-react'

type Props =
  | { mode: 'create' }
  | { mode: 'delete'; teamId: string; teamName: string }

export function TeamActions(props: Props) {
  if (props.mode === 'create') return <CreateTeamDialog />
  return <DeleteTeamButton teamId={props.teamId} teamName={props.teamName} />
}

function CreateTeamDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createTeamAction(formData)
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          New team
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input id="team-name" name="name" placeholder="Engineering" required />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" size="sm" disabled={pending}>
              {pending ? 'Creating…' : 'Create team'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTeamButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} aria-label={`Delete ${teamName}`}>
          <Trash2 className="h-3.5 w-3.5 text-ink-muted" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {teamName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the team and revokes all project access for its members.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => startTransition(() => deleteTeamAction(teamId))}
            className="bg-danger-500 text-white hover:bg-danger-500/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
