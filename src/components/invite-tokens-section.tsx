'use client'

import { useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FieldError, useFeedback } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createInvitationAction, revokeInvitationAction } from '@/lib/actions/settings'

type Invitation = {
  id: string
  organizationRole: string | null
  grantInstanceAdmin: boolean
  reusable: boolean
  maxUses: number | null
  useCount: number
  note: string | null
  usedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  createdByName: string | null
}

interface InviteTokensSectionProps {
  invitations: Invitation[]
  role: string
  showInstanceAdmin: boolean
  teams: Array<{ id: string; name: string }>
}

export function InviteTokensSection({
  invitations,
  role,
  showInstanceAdmin,
  teams,
}: InviteTokensSectionProps) {
  const [open, setOpen] = useState(false)
  const [roleValue, setRoleValue] = useState<'owner' | 'admin' | 'member'>('member')
  const [uses, setUses] = useState('single')
  const [maxUses, setMaxUses] = useState('2')
  const [admin, setAdmin] = useState(false)
  const [note, setNote] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const { toast } = useFeedback()
  const canInvite = role !== 'member' || showInstanceAdmin

  async function create() {
    setPending(true)
    setError(null)
    const result = await createInvitationAction({
      role: roleValue,
      grantInstanceAdmin: admin,
      maxUses: uses === 'unlimited' ? null : uses === 'limited' ? Number(maxUses) : 1,
      teamIds,
      note,
      expiresAt,
    })
    if (result.error) setError(result.error)
    else setLink(result.inviteUrl ?? null)
    setPending(false)
  }

  async function copy() {
    if (!link) return
    await navigator.clipboard.writeText(new URL(link, window.location.origin).toString())
    toast({ title: 'Invitation link copied', tone: 'success' })
  }

  async function revoke(id: string) {
    await revokeInvitationAction(id)
    window.location.reload()
  }

  function status(invitation: Invitation) {
    if (invitation.revokedAt) return 'Revoked'
    if (invitation.expiresAt && new Date(invitation.expiresAt) <= new Date()) return 'Expired'
    if (!invitation.reusable && invitation.usedAt) return 'Accepted'
    if (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses) return 'Accepted'
    return 'Active'
  }

  const invitationUrl = link
    ? new URL(link, typeof window === 'undefined' ? 'http://localhost' : window.location.origin).toString()
    : ''

  return (
    <Card>
      <CardHeader className="min-h-0 py-3">
        <div className="min-w-0">
          <CardTitle>Invitations</CardTitle>
          <CardDescription>Share invitation links with the roles and number of uses you choose.</CardDescription>
        </div>
        {canInvite ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="primary" size="sm">
                <Plus />
                Invite member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create invitation</DialogTitle>
                <DialogDescription>
                  Choose the access granted when someone uses this invitation.
                </DialogDescription>
              </DialogHeader>

              {link ? (
                <>
                  <DialogBody className="space-y-3">
                    <p className="text-[13px] text-ink-muted">
                      Share this invitation link. The secret is kept inside the link.
                    </p>
                    <div className="flex gap-2">
                      <Input aria-label="Invitation link" readOnly value={invitationUrl} />
                      <Button size="icon" onClick={copy} aria-label="Copy invitation link">
                        <Copy />
                      </Button>
                    </div>
                  </DialogBody>
                  <DialogFooter>
                    <Button onClick={() => { setOpen(false); setLink(null) }}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogBody className="space-y-5">
                    {showInstanceAdmin ? (
                      <div className="space-y-2">
                        <Label htmlFor="invitation-instance-role">Instance role</Label>
                        <Select value={admin ? 'admin' : 'member'} onValueChange={(value) => {
                          setAdmin(value === 'admin')
                          if (value === 'admin') setUses('single')
                        }}>
                          <SelectTrigger id="invitation-instance-role"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="invitation-role">Organization role</Label>
                      <Select
                        value={roleValue}
                        onValueChange={(value) => {
                          setRoleValue(value as typeof roleValue)
                          if (value !== 'member') setUses('single')
                        }}
                      >
                        <SelectTrigger id="invitation-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {role === 'owner' || showInstanceAdmin ? <SelectItem value="owner">Owner</SelectItem> : null}
                        </SelectContent>
                      </Select>
                    </div>

                    {teams.length ? (
                      <fieldset className="space-y-2.5">
                        <legend className="text-[13px] font-medium text-ink">
                          Teams <span className="font-normal text-ink-muted">(optional)</span>
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {teams.map((team) => {
                            const id = `invitation-team-${team.id}`
                            return (
                              <div key={team.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={id}
                                  checked={teamIds.includes(team.id)}
                                  onCheckedChange={(checked) => setTeamIds(checked
                                    ? [...teamIds, team.id]
                                    : teamIds.filter((teamId) => teamId !== team.id))}
                                />
                                <Label htmlFor={id} className="font-normal">{team.name}</Label>
                              </div>
                            )
                          })}
                        </div>
                      </fieldset>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor="invitation-uses">Uses</Label>
                      <Select value={uses} onValueChange={setUses} disabled={roleValue !== 'member' || admin}>
                        <SelectTrigger id="invitation-uses"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single use</SelectItem>
                          <SelectItem value="limited">Limited uses</SelectItem>
                          <SelectItem value="unlimited">Unlimited uses</SelectItem>
                        </SelectContent>
                      </Select>
                      {uses === 'limited' ? (
                        <div className="space-y-2 pt-2">
                          <Label htmlFor="invitation-max-uses">Maximum uses</Label>
                          <Input id="invitation-max-uses" type="number" min={2} max={2147483647} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} />
                        </div>
                      ) : null}
                      <p className="text-xs text-ink-muted">
                        {roleValue !== 'member' || admin
                          ? 'Invitations granting elevated access are single-use.'
                          : uses === 'single'
                            ? 'The link stops working after one acceptance.'
                            : uses === 'limited'
                              ? 'The link stops working after the maximum number of acceptances.'
                              : 'The link can be accepted repeatedly until it expires or you revoke it.'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invitation-expires">Expires <span className="font-normal text-ink-muted">(optional)</span></Label>
                      <Input id="invitation-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invitation-note">Note <span className="font-normal text-ink-muted">(optional)</span></Label>
                      <Input id="invitation-note" value={note} onChange={(event) => setNote(event.target.value)} />
                    </div>
                    <FieldError>{error}</FieldError>
                  </DialogBody>
                  <DialogFooter>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="primary" onClick={create} disabled={pending}>
                      {pending ? 'Creating…' : 'Create invitation'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Access</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created by</TableHead>
              {canInvite ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canInvite ? 6 : 5} className="py-8 text-center text-[13px] text-ink-muted">
                  No invitations yet.
                </TableCell>
              </TableRow>
            ) : invitations.map((invitation) => {
              const invitationStatus = status(invitation)
              return (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">{invitation.organizationRole ?? 'Instance admin'}</Badge>
                      {invitation.grantInstanceAdmin ? <span className="text-xs text-ink-muted">Instance admin</span> : null}
                    </div>
                  </TableCell>
                  <TableCell>{invitation.useCount} / {invitation.maxUses ?? 'Unlimited'}</TableCell>
                  <TableCell><Badge variant={invitationStatus === 'Active' ? 'success' : 'secondary'}>{invitationStatus}</Badge></TableCell>
                  <TableCell>{invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString() : 'Never'}</TableCell>
                  <TableCell>{invitation.createdByName ?? '—'}</TableCell>
                  {canInvite ? (
                    <TableCell>
                      {invitationStatus === 'Active' ? (
                        <Button variant="ghost" size="icon" onClick={() => revoke(invitation.id)} aria-label="Revoke invitation">
                          <Trash2 />
                        </Button>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
