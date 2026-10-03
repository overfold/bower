'use client'

import { useEffect, useId, useState, useMemo, useTransition } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { addTeamMemberAction, createTeamAction, deleteTeamAction, removeTeamMemberAction, updateTeamAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, User } from 'lucide-react'
import { InlineNotice } from '@/components/ui/feedback'
import { RowActions, RowActionItem, RowActionSeparator } from '@/components/ui/row-actions'

type Props =
  | { mode: 'create' }
  | { mode: 'edit'; teamId: string; teamName: string }
  | { mode: 'delete'; teamId: string; teamName: string }

export function TeamActions(props: Props) {
  if (props.mode === 'create') return <CreateTeamDialog />
  return <TeamRowActions teamId={props.teamId} teamName={props.teamName} />
}

export function TeamRowActions({ teamId, teamName, renameButton = false, deleteButton = false }: { teamId: string; teamName: string; renameButton?: boolean; deleteButton?: boolean }) {
  const [action, setAction] = useState<'edit' | 'delete' | null>(null)
  return <>
    {renameButton ? <Button size="sm" onClick={() => setAction('edit')}>Rename</Button> : deleteButton ? <Button size="sm" variant="danger" onClick={() => setAction('delete')}>Delete team</Button> :
      <RowActions name={teamName}><RowActionItem onSelect={() => setAction('edit')}>Rename</RowActionItem><RowActionSeparator /><RowActionItem className="text-danger-600 focus:text-danger-600" onSelect={() => setAction('delete')}>Delete</RowActionItem></RowActions>}
    <EditTeamDialog teamId={teamId} teamName={teamName} open={action === 'edit'} onOpenChange={(open) => setAction(open ? 'edit' : null)} />
    <DeleteTeamButton teamId={teamId} teamName={teamName} open={action === 'delete'} onOpenChange={(open) => setAction(open ? 'delete' : null)} />
  </>
}

function CreateTeamDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await createTeamAction(formData)
        setOpen(false)
      } catch (err) {
        setError(actionErrorMessage(err, 'Could not create team.'))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (next) setError(null) } }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          New team
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-3">
            {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
            <div className="space-y-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input id="team-name" name="name" required />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" size="sm" disabled={pending} aria-busy={pending}>
              {pending ? 'Creating…' : 'Create team'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditTeamDialog({ teamId, teamName, open, onOpenChange }: { teamId: string; teamName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await updateTeamAction(teamId, formData)
        onOpenChange(false)
      } catch (err) {
        setError(actionErrorMessage(err, 'Could not update team.'))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) { onOpenChange(next); if (next) setError(null) } }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-3">
            {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
            <div className="space-y-2">
              <Label htmlFor={`team-name-${teamId}`}>Team name</Label>
              <Input id={`team-name-${teamId}`} name="name" defaultValue={teamName} required />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" size="sm" disabled={pending} aria-busy={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTeamButton({ teamId, teamName, open, onOpenChange }: { teamId: string; teamName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function remove(event: React.MouseEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await deleteTeamAction(teamId)
        onOpenChange(false)
      } catch (err) {
        setError(actionErrorMessage(err, 'Could not delete team.'))
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { onOpenChange(next); if (next) setError(null) } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {teamName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the team and revokes all project access for its members.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            aria-busy={pending}
            onClick={remove}
          >
            {pending ? 'Deleting…' : 'Delete team'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function AddTeamMemberDialog({ teamId, orgMembers, existingMemberIds }: {
  teamId: string
  orgMembers?: { userId: string; name: string; email: string }[]
  existingMemberIds?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [selectedEmail, setSelectedEmail] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const listboxId = useId()
  const statusId = useId()

  const suggestions = useMemo(() => {
    if (!orgMembers || !search) return []
    const q = search.toLowerCase()
    const existing = new Set(existingMemberIds ?? [])
    return orgMembers
      .filter((m) => !existing.has(m.userId) && (m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [orgMembers, existingMemberIds, search])

  function handleClose() {
    setOpen(false)
    setSearch('')
    setSelectedEmail('')
    setActiveIndex(-1)
    setError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    if (selectedEmail) formData.set('email', selectedEmail)
    setError(null)
    startTransition(async () => {
      try {
        await addTeamMemberAction(teamId, formData)
        handleClose()
      } catch (err) {
        setError(actionErrorMessage(err, 'Could not add team member.'))
      }
    })
  }

  function selectSuggestion(email: string) {
    setSelectedEmail(email)
    setSearch(email)
    setActiveIndex(-1)
  }

  const resultsOpen = Boolean(search && !selectedEmail && suggestions.length)

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(`${listboxId}-option-${suggestions[activeIndex]?.userId}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, listboxId, suggestions])

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && resultsOpen) {
      event.preventDefault()
      event.stopPropagation()
      setActiveIndex(-1)
      setSearch('')
      setSelectedEmail('')
      return
    }
    if (!resultsOpen) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => current < 0
        ? (direction === 1 ? 0 : suggestions.length - 1)
        : (current + direction + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      selectSuggestion(suggestions[activeIndex].email)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (pending) return; if (!v) handleClose(); else { setError(null); setOpen(true) } }}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Plus className="h-4 w-4" />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-3">
            {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
            <div className="space-y-2">
              <Label htmlFor={`member-email-${teamId}`}>Search members</Label>
              <Input
                id={`member-email-${teamId}`}
                name="email"
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedEmail(''); setActiveIndex(-1) }}
                required
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={resultsOpen}
                aria-controls={listboxId}
                aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${suggestions[activeIndex]?.userId}` : undefined}
                aria-describedby={statusId}
                onKeyDown={handleKeyDown}
              />
            </div>
            <p id={statusId} className="sr-only" aria-live="polite">{search && !selectedEmail ? `${suggestions.length} member ${suggestions.length === 1 ? 'result' : 'results'} available.` : selectedEmail ? `${selectedEmail} selected.` : ''}</p>
            {resultsOpen && (
              <div id={listboxId} role="listbox" aria-label="Member results" className="max-h-[200px] overflow-y-auto rounded-lg border border-line scroll-thin">
                {suggestions.map((m, index) => (
                  <button
                    key={m.userId}
                    id={`${listboxId}-option-${m.userId}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    tabIndex={-1}
                    type="button"
                    onClick={() => selectSuggestion(m.email)}
                    onMouseMove={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-sunken ${activeIndex === index ? 'bg-sunken' : ''}`}
                  >
                    <User className="h-4 w-4 shrink-0 text-ink-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ink">{m.name}</div>
                      <div className="text-xs text-ink-muted">{m.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" size="sm" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" size="sm" disabled={pending} aria-busy={pending}>
              {pending ? 'Adding…' : 'Add member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RemoveTeamMemberButton({ teamId, membershipId, memberName }: { teamId: string; membershipId: string; memberName: string }) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function remove(event: React.MouseEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await removeTeamMemberAction(teamId, membershipId)
        setOpen(false)
      } catch (err) {
        setError(actionErrorMessage(err, 'Could not remove team member.'))
      }
    })
  }

  return (
    <>
      <RowActions name={memberName}><RowActionSeparator /><RowActionItem className="text-danger-600 focus:text-danger-600" disabled={pending} onSelect={() => setOpen(true)}>Remove member</RowActionItem></RowActions>
      <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (next) setError(null) } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {memberName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the member from this team. They will lose any project access granted through this team.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            aria-busy={pending}
            onClick={remove}
          >
            {pending ? 'Removing…' : 'Remove member'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
