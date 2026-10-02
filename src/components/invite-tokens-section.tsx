'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { actionErrorMessage } from '@/lib/action-error'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { Chip } from '@/components/ui/badge'
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
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createInvitationAction, revokeInvitationAction } from '@/lib/actions/settings'
import { formatDate } from '@/lib/format'

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
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [roleValue, setRoleValue] = useState<'owner' | 'admin' | 'member'>('member')
  const [uses, setUses] = useState('single')
  const [maxUses, setMaxUses] = useState('2')
  const [admin, setAdmin] = useState(false)
  const [note, setNote] = useState('')
  const [expiry, setExpiry] = useState('7d')
  const [customExpiry, setCustomExpiry] = useState('')
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useFeedback()
  const canInvite = role !== 'member' || showInstanceAdmin

  useEffect(() => {
    if (searchParams.get('action') !== 'invite') return
    if (canInvite) queueMicrotask(() => setOpen(true))
    const next = new URLSearchParams(searchParams.toString())
    next.delete('action')
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [canInvite, pathname, router, searchParams])

  async function create() {
    setPending(true)
    setError(null)
    try {
      const result = await createInvitationAction({
        role: roleValue,
        grantInstanceAdmin: admin,
        maxUses: uses === 'unlimited' ? null : uses === 'limited' ? Number(maxUses) : 1,
        teamIds,
        note,
        expiresAt: expiry === 'never' ? '' : expiry === 'custom'
          ? customExpiry
          : new Date(Date.now() + Number(expiry.slice(0, -1)) * 24 * 60 * 60 * 1000).toISOString(),
      })
      if (result.error) setError(result.error)
      else setLink(result.inviteUrl ?? null)
    } catch (cause) {
      setError(actionErrorMessage(cause, 'Could not create invitation.'))
    } finally {
      setPending(false)
    }
  }

  async function copy() {
    if (!link) return
    await navigator.clipboard.writeText(new URL(link, window.location.origin).toString())
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Invitation link copied', tone: 'success' })
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
          <Dialog open={open} onOpenChange={(next) => {
            if (pending) return
            setOpen(next)
            if (next) setError(null)
            else { setLink(null); setCopied(false) }
          }}>
            <DialogTrigger asChild>
              <Button variant="primary" size="sm">
                <Plus />
                Invite people
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{link ? 'Invitation created' : 'Invite people'}</DialogTitle>
                <DialogDescription>
                  {link ? 'Copy and share this link now.' : 'Create a link with the access, expiry, and number of uses you choose.'}
                </DialogDescription>
              </DialogHeader>

              {link ? (
                <>
                  <DialogBody className="space-y-3">
                    <p className="text-sm text-ink-muted">
                      Share this invitation link. The secret is kept inside the link.
                    </p>
                    <div className="flex gap-2">
                      <Input aria-label="Invitation link" readOnly value={invitationUrl} />
                      <Button onClick={copy} aria-label="Copy invitation link">
                        <Copy /> {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </DialogBody>
                  <DialogFooter>
                    <Button variant="primary" disabled={!copied} onClick={() => { setOpen(false); setLink(null) }}>I’ve saved this</Button>
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
                            <SelectItem value="member">User</SelectItem>
                            <SelectItem value="admin">Instance admin</SelectItem>
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
                        <legend><Label optional>Teams</Label></legend>
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
                        <SelectTrigger id="invitation-uses" aria-describedby="invitation-uses-help"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single use</SelectItem>
                          <SelectItem value="limited">Limited uses</SelectItem>
                          <SelectItem value="unlimited">Unlimited uses</SelectItem>
                        </SelectContent>
                      </Select>
                      {uses === 'limited' ? (
                        <div className="space-y-2 pt-2">
                          <Label htmlFor="invitation-max-uses">Maximum uses</Label>
                          <Input id="invitation-max-uses" type="number" min={2} max={2147483647} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} className="max-w-48" />
                        </div>
                      ) : null}
                      <p id="invitation-uses-help" className="text-xs text-ink-muted">
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
                      <Label htmlFor="invitation-expires">Expires</Label>
                      <Select value={expiry} onValueChange={setExpiry}><SelectTrigger id="invitation-expires"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1d">24 hours</SelectItem><SelectItem value="7d">7 days</SelectItem><SelectItem value="30d">30 days</SelectItem><SelectItem value="never">Never</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select>
                      {expiry === 'custom' ? <Input aria-label="Custom expiry" type="datetime-local" value={customExpiry} onChange={(event) => setCustomExpiry(event.target.value)} required /> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invitation-note" optional>Note</Label>
                      <Input id="invitation-note" value={note} onChange={(event) => setNote(event.target.value)} />
                    </div>
                    {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
                  </DialogBody>
                  <DialogFooter>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="primary" onClick={create} disabled={pending} aria-busy={pending}>
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
        <div className="overflow-x-auto">
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
                <TableCell colSpan={canInvite ? 6 : 5} className="py-8 text-center text-sm text-ink-muted">
                  No invitations yet.
                </TableCell>
              </TableRow>
            ) : invitations.map((invitation) => {
              const invitationStatus = status(invitation)
              return (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Chip className="capitalize">{invitation.organizationRole ?? 'Instance admin'}</Chip>
                      {invitation.grantInstanceAdmin ? <span className="text-xs text-ink-muted">Instance admin</span> : null}
                    </div>
                  </TableCell>
                  <TableCell>{invitation.useCount} / {invitation.maxUses ?? 'Unlimited'}</TableCell>
                  <TableCell><Chip tone={invitationStatus === 'Active' ? 'success' : 'neutral'}>{invitationStatus}</Chip></TableCell>
                  <TableCell className="whitespace-nowrap">{invitation.expiresAt ? formatDate(invitation.expiresAt) : 'Never'}</TableCell>
                  <TableCell>{invitation.createdByName ?? '—'}</TableCell>
                  {canInvite ? (
                    <TableCell>
                      {invitationStatus === 'Active' ? (
                        <RevokeInvitationButton invitation={invitation} />
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function RevokeInvitationButton({ invitation }: { invitation: Invitation }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useFeedback()

  async function revoke(event: React.MouseEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await revokeInvitationAction(invitation.id)
      setOpen(false)
      toast({ tone: 'success', title: 'Invitation revoked.' })
    } catch (cause) {
      setError(actionErrorMessage(cause, 'Could not revoke invitation.'))
    } finally {
      setPending(false)
    }
  }

  const target = invitation.note ? `“${invitation.note}”` : `created ${formatDate(invitation.createdAt)}`
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (next) setError(null) } }}>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" disabled={pending} aria-label={`Revoke invitation ${target}`}><Trash2 /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Revoke invitation?</AlertDialogTitle><AlertDialogDescription>The invitation {target} will stop accepting new members. Existing members keep their access.</AlertDialogDescription></AlertDialogHeader>
        {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
        <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={revoke} disabled={pending} aria-busy={pending}>{pending ? 'Revoking…' : 'Revoke invitation'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
