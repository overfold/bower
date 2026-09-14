'use client'

import { useState, useTransition, useMemo } from 'react'
import { grantProjectAccessAction, revokeProjectTeamAccessAction, revokeProjectUserAccessAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2, Users, User } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    if (!search) return all
    const q = search.toLowerCase()
    return all.filter(item => {
      if (item.name.toLowerCase().includes(q)) return true
      if (item.kind === 'user' && item.email.toLowerCase().includes(q)) return true
      return false
    })
  }, [teams, members, existingTeamIds, existingUserIds, search])

  function handleSubmit() {
    if (!selected || selected.granted) return
    setError(null)
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
        setError(e instanceof Error ? e.message : 'Failed to grant access.')
      }
    })
  }

  function handleClose() {
    setOpen(false)
    setSelected(null)
    setSearch('')
    setError(null)
    setRole('viewer')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Grant access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant project access</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="access-search">Search teams and members</Label>
            <Input
              id="access-search"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto rounded-lg border border-line scroll-thin">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-ink-muted">No results found.</div>
            ) : (
              items.map((item) => {
                const isSelected = selected?.kind === item.kind && selected?.id === item.id
                return (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    disabled={item.granted}
                    onClick={() => setSelected(item)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left text-[13px] transition-colors last:border-b-0',
                      item.granted
                        ? 'cursor-default opacity-50'
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
          </div>
          {selected && !selected.granted && (
            <div className="space-y-2">
              <Label htmlFor="access-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="access-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="deployer">Deployer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-ink-muted">
                {selected.kind === 'team' ? `All members of ${selected.name}` : selected.name} will receive {role} access to this project.
              </p>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="default" size="sm" onClick={handleClose} disabled={pending}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={pending || !selected || selected.granted}>
            {pending ? 'Granting…' : 'Grant access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RevokeAccessButton({ projectId, accessId, kind, name }: {
  projectId: string; accessId: string; kind: 'team' | 'user'; name: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} aria-label={`Revoke access for ${name}`}>
          <Trash2 className="h-3.5 w-3.5 text-ink-muted" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke access for {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {kind === 'team'
              ? `Members of ${name} will lose their team-granted access to this project.`
              : `${name} will lose their individual access to this project.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => startTransition(() =>
              kind === 'team'
                ? revokeProjectTeamAccessAction(projectId, accessId)
                : revokeProjectUserAccessAction(projectId, accessId)
            )}
            className="bg-danger-500 text-white hover:bg-danger-500/90"
          >
            Revoke
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
