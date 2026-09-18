'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, MailPlus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, InlineNotice } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  createInviteTokenAction,
  createInstanceTokenAction,
  revokeInviteTokenAction,
  revokeInstanceTokenAction,
} from '@/lib/actions/settings'

interface InvitationRow {
  kind: 'organization' | 'instance'
  token: {
    id: string
    tokenPrefix: string
    role: string | null
    note: string | null
    usedAt: string | null
    expiresAt: string | null
    createdAt: string
  }
  createdByName: string | null
}

interface InviteTokensSectionProps {
  tokens: InvitationRow[]
  role: string
  showInstanceAdmin: boolean
}

function tokenStatus(token: InvitationRow['token']): { label: string; variant: 'secondary' | 'danger' | 'success' } {
  if (token.usedAt) return { label: 'Used', variant: 'secondary' }
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) return { label: 'Expired', variant: 'danger' }
  return { label: 'Active', variant: 'success' }
}

export function InviteTokensSection({ tokens, role, showInstanceAdmin }: InviteTokensSectionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [selectedInstanceRole, setSelectedInstanceRole] = useState<'user' | 'admin'>('user')
  const [selectedRole, setSelectedRole] = useState<'owner' | 'admin' | 'member'>('member')
  const isOrgAdmin = role === 'owner' || role === 'admin'
  const canInvite = isOrgAdmin || showInstanceAdmin

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const note = (formData.get('note') as string | undefined) || undefined
    const result = showInstanceAdmin && selectedInstanceRole === 'admin'
      ? await createInstanceTokenAction(note)
      : await createInviteTokenAction(selectedRole, note)

    if (result?.error) setError(result.error)
    else if (result?.token) {
      setCreatedToken(result.token)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleRevoke(row: InvitationRow) {
    const key = `${row.kind}:${row.token.id}`
    setRevoking(key)
    if (row.kind === 'instance') await revokeInstanceTokenAction(row.token.id)
    else await revokeInviteTokenAction(row.token.id)
    router.refresh()
    setRevoking(null)
  }

  function handleClose() {
    setOpen(false)
    setCreatedToken(null)
    setError(null)
    setSelectedInstanceRole('user')
    setSelectedRole('member')
  }

  const isInstanceInvitation = showInstanceAdmin && selectedInstanceRole === 'admin'

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Invitations</CardTitle>
          <p className="mt-0.5 text-xs text-ink-muted">
            {showInstanceAdmin
              ? 'One-time invitation tokens for organization members and instance administrators'
              : 'One-time invitation tokens for new organization members'}
          </p>
        </div>
        {canInvite ? (
          <Dialog open={open} onOpenChange={(value) => { if (!value) handleClose(); else setOpen(true) }}>
            <DialogTrigger asChild>
              <Button variant="primary" size="sm">
                <Plus className="h-4 w-4" />
                Invite member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Invite member</DialogTitle>
                <DialogDescription>
                  Create a one-time invitation token for a new Bower account.
                </DialogDescription>
              </DialogHeader>
              {createdToken ? (
                <>
                  <DialogBody>
                    <div className="space-y-3">
                      <p className="text-[13px] font-medium text-ink">Copy this invitation token now. It will not be shown again.</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 break-all rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-[12.5px] text-ink">
                          {createdToken}
                        </code>
                        <Button variant="default" size="icon" onClick={() => navigator.clipboard.writeText(createdToken)} aria-label="Copy invitation">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </DialogBody>
                  <DialogFooter>
                    <Button variant="primary" size="sm" onClick={handleClose}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <form onSubmit={handleCreate}>
                  <DialogBody className="space-y-4">
                    {showInstanceAdmin ? (
                      <div className="space-y-2">
                        <Label htmlFor="invite-instance-role">Instance role</Label>
                        <Select
                          value={selectedInstanceRole}
                          onValueChange={(value) => setSelectedInstanceRole(value as 'user' | 'admin')}
                        >
                          <SelectTrigger id="invite-instance-role"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {!isInstanceInvitation ? (
                      <div className="space-y-2">
                        <Label htmlFor="invite-role">
                          {showInstanceAdmin ? 'Organization role' : 'Role'}
                        </Label>
                        <Select
                          value={selectedRole}
                          onValueChange={(value) => setSelectedRole(value as 'owner' | 'admin' | 'member')}
                        >
                          <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            {(role === 'owner' || showInstanceAdmin) ? <SelectItem value="owner">Owner</SelectItem> : null}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-xs leading-relaxed text-ink-muted">
                        Instance administrators have instance-wide access, so an organization role is not required.
                      </p>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="note">Note <span className="font-normal text-ink-muted">(optional)</span></Label>
                      <Input id="note" name="note" placeholder="e.g. Platform team" />
                    </div>
                    {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
                  </DialogBody>
                  <DialogFooter>
                    <Button variant="default" type="button" size="sm" onClick={handleClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" type="submit" size="sm" disabled={loading}>
                      {loading ? 'Creating…' : 'Create invitation'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {tokens.length === 0 ? (
          <EmptyState
            icon={<MailPlus className="h-5 w-5" />}
            title="No invitations yet"
            body={canInvite ? 'Create an invitation to add someone to Bower.' : 'No organization invitations have been created.'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invitation</TableHead>
                {showInstanceAdmin ? <TableHead>Instance Role</TableHead> : null}
                <TableHead>{showInstanceAdmin ? 'Organization Role' : 'Role'}</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created</TableHead>
                {canInvite ? <TableHead className="w-[56px]" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((row) => {
                const status = tokenStatus(row.token)
                const revokeKey = `${row.kind}:${row.token.id}`
                return (
                  <TableRow key={revokeKey}>
                    <TableCell className="font-mono text-xs">{row.token.tokenPrefix}…</TableCell>
                    {showInstanceAdmin ? (
                      <TableCell>
                        <Badge variant={row.kind === 'instance' ? 'default' : 'secondary'}>
                          {row.kind === 'instance' ? 'Administrator' : 'User'}
                        </Badge>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      {row.token.role ? (
                        <Badge variant="secondary" className="capitalize">{row.token.role}</Badge>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-ink-muted">{row.token.note || '—'}</TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                    <TableCell>{row.createdByName || '—'}</TableCell>
                    <TableCell className="text-xs text-ink-muted">{new Date(row.token.createdAt).toLocaleDateString()}</TableCell>
                    {canInvite ? (
                      <TableCell>
                        {!row.token.usedAt ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevoke(row)}
                            disabled={revoking === revokeKey}
                            aria-label="Revoke invitation"
                          >
                            <Trash2 className="h-4 w-4 text-ink-muted" />
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
