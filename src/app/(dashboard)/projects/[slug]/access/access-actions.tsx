'use client'

import { useState, useTransition, useMemo } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { grantProjectAccessAction, revokeProjectTeamAccessAction, revokeProjectUserAccessAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Users, User } from 'lucide-react'
import { RowActions, RowActionItem, RowActionSeparator } from '@/components/ui/row-actions'
import { cn } from '@/lib/utils'
import { FieldError, InlineNotice } from '@/components/ui/feedback'

type SearchItem =
  | { kind: 'team'; id: string; name: string; granted: boolean }
  | { kind: 'user'; id: string; userId: string; name: string; email: string; granted: boolean }

interface GrantAccessDialogProps {
  projectId: string
  teams: { id: string; name: string }[]
  members: { id: string; userId: string; name: string; email: string }[]
  existingTeamIds: string[]
  existingUserIds: string[]
}

export function GrantAccessDialog({ projectId, teams, members, existingTeamIds, existingUserIds }: GrantAccessDialogProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SearchItem | null>(null)
  const [role, setRole] = useState<string>('viewer')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const items = useMemo(() => {
    const all: SearchItem[] = [
      ...teams.map(t => ({
        kind: 'team' as const, id: t.id, name: t.name,
        granted: existingTeamIds.includes(t.id),
      })),
      ...members.map(m => ({
        kind: 'user' as const, id: m.id, userId: m.userId, name: m.name, email: m.email,
        granted: existingUserIds.includes(m.userId),
      })),
    ]
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return all.filter(item => !item.granted && (() => {
      if (item.name.toLowerCase().includes(q)) return true
      if (item.kind === 'user' && item.email.toLowerCase().includes(q)) return true
      return false
    })())
  }, [teams, members, existingTeamIds, existingUserIds, search])

  function handleSubmit() {
    if (!selected || selected.granted) {
      setSearchError('Choose a team or member from the search results.')
      document.getElementById('access-search')?.focus()
      return
    }
    setError(null)
    setSearchError(null)
    const formData = new FormData()
    formData.set('kind', selected.kind)
    formData.set('role', role)
    if (selected.kind === 'team') {
      formData.set('teamId', selected.id)
    } else {
      formData.set('email', selected.email)
    }
    startTransition(async () => {
      try {
        await grantProjectAccessAction(projectId, formData)
        setOpen(false)
        setSelected(null)
        setSearch('')
      } catch (e) {
        setError(actionErrorMessage(e, 'Failed to grant access.'))
      }
    })
  }

  function handleClose() {
    setOpen(false)
    setSelected(null)
    setSearch('')
    setError(null)
    setSearchError(null)
    setRole('viewer')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (pending) return; if (!v) handleClose(); else { setError(null); setOpen(true) } }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Grant access
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Grant project access</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <div className="space-y-2">
            <Label htmlFor="access-search">Search teams and members</Label>
            <div className="overflow-hidden rounded-lg border border-line-strong bg-surface">
              <Input
                id="access-search"
                aria-invalid={Boolean(searchError)}
                aria-describedby={searchError ? 'access-search-error' : undefined}
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-none border-0"
                autoFocus
              />
              {search.trim() ? <div className="relative max-h-[240px] overflow-y-auto border-t border-line scroll-thin after:pointer-events-none after:sticky after:bottom-0 after:block after:h-4 after:bg-gradient-to-t after:from-surface">
                {items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-ink-muted">No results found.</div>
                ) : (
                  items.map((item) => {
                    const isSelected = selected?.kind === item.kind && selected?.id === item.id
                    return (
                      <button
                        key={`${item.kind}-${item.id}`}
                        type="button"
                        disabled={item.granted}
                        onClick={() => { setSelected(item); setSearchError(null) }}
                        className={cn(
                          "flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left text-sm transition-colors last:border-b-0",
                          item.granted
                            ? 'cursor-not-allowed text-ink-muted'
                            : isSelected
                              ? 'bg-brand-50 text-ink'
                              : 'hover:bg-sunken text-ink',
                        )}
                      >
                        {item.kind === 'team' ? (
                          <Users className="h-4 w-4 shrink-0 text-ink-muted" />
                        ) : (
                          <User className="h-4 w-4 shrink-0 text-ink-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{item.name}</div>
                          {item.kind === 'user' && (
                            <div className="text-xs text-ink-muted">{item.email}</div>
                          )}
                          {item.kind === 'team' && (
                            <div className="text-xs text-ink-muted">Team</div>
                          )}
                        </div>
                        {item.granted && (
                          <span className="shrink-0 text-xs text-ink-muted">Granted</span>
                        )}
                      </button>
                    )
                  })
                )}
              </div> : null}
            </div>
            <div id="access-search-error"><FieldError>{searchError}</FieldError></div>
          </div>
          <div className="space-y-2">
              <Label htmlFor="access-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="access-role" aria-describedby={selected ? 'access-role-help' : undefined}><SelectValue>{role.charAt(0).toUpperCase() + role.slice(1)}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer"><span className="block">Viewer</span><span className="block text-xs text-ink-muted">View project configuration and deployments.</span></SelectItem>
                  <SelectItem value="deployer"><span className="block">Deployer</span><span className="block text-xs text-ink-muted">View, deploy, and roll back services.</span></SelectItem>
                  <SelectItem value="admin"><span className="block">Admin</span><span className="block text-xs text-ink-muted">Manage settings, services, and project access.</span></SelectItem>
                </SelectContent>
              </Select>
              {selected ? <p id="access-role-help" className="text-xs text-ink-muted">{`${selected.kind === 'team' ? `All members of ${selected.name}` : selected.name} will receive ${role} access to this project.`}</p> : null}
            </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="default" size="sm" onClick={handleClose} disabled={pending}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={pending} aria-busy={pending}>
            {pending ? 'Granting…' : 'Grant access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RevokeAccessButton({ projectId, accessId, kind, name, email }: {
  projectId: string; accessId: string; kind: 'team' | 'user'; name: string; email?: string
}) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function revoke(event: React.MouseEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await (kind === 'team'
          ? revokeProjectTeamAccessAction(projectId, accessId)
          : revokeProjectUserAccessAction(projectId, accessId))
        setOpen(false)
      } catch (err) {
        setError(actionErrorMessage(err, 'Could not revoke access.'))
      }
    })
  }

  return (
    <>
      <RowActions name={name}><RowActionSeparator /><RowActionItem className="text-danger-600 focus:text-danger-600" disabled={pending} onSelect={() => setOpen(true)}>Revoke access</RowActionItem></RowActions>
      <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (next) setError(null) } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke access for {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {kind === 'team'
              ? `Members of ${name} will lose their team-granted access to this project.`
              : <>{email ? <span className="block">{email}</span> : null}{name} will lose their individual access to this project.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            aria-busy={pending}
            onClick={revoke}
          >
            {pending ? 'Revoking…' : 'Revoke access'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
