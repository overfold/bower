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
import { createInviteTokenAction, revokeInviteTokenAction } from '@/lib/actions/settings'

interface TokenRow {
  token: {
    id: string
    tokenPrefix: string
    role: string
    note: string | null
    usedAt: string | null
    expiresAt: string | null
    createdAt: string
  }
  createdByName: string | null
}

interface InviteTokensSectionProps {
  tokens: TokenRow[]
  role: string
}

function tokenStatus(token: TokenRow['token']): { label: string; variant: 'secondary' | 'danger' | 'success' } {
  if (token.usedAt) return { label: 'Used', variant: 'secondary' }
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) return { label: 'Expired', variant: 'danger' }
  return { label: 'Active', variant: 'success' }
}

export function InviteTokensSection({ tokens, role }: InviteTokensSectionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('member')
  const isAdmin = role === 'owner' || role === 'admin'

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await createInviteTokenAction(
      selectedRole as 'owner' | 'admin' | 'member',
      (formData.get('note') as string | undefined) || undefined,
    )
    if (result?.error) setError(result.error)
    else if (result?.token) {
      setCreatedToken(result.token)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleRevoke(tokenId: string) {
    setRevoking(tokenId)
    await revokeInviteTokenAction(tokenId)
    router.refresh()
    setRevoking(null)
  }

  function handleClose() {
    setOpen(false)
    setCreatedToken(null)
    setError(null)
    setSelectedRole('member')
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Invitations</CardTitle>
          <p className="mt-0.5 text-xs text-ink-muted">One-time invite links for new organization members</p>
        </div>
        {isAdmin ? (
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
                <DialogDescription>Create a one-time invite link for this organization.</DialogDescription>
              </DialogHeader>
              {createdToken ? (
                <>
                  <DialogBody>
                    <div className="space-y-3">
                      <p className="text-[13px] font-medium text-ink">Copy this invite link token now. It will not be shown again.</p>
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
                    <div className="space-y-2">
                      <Label htmlFor="invite-role">Organization role</Label>
                      <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {role === 'owner' ? <SelectItem value="owner">Owner</SelectItem> : null}
                        </SelectContent>
                      </Select>
                    </div>
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
            body={isAdmin ? 'Create an invitation to add someone to this organization.' : 'No organization invitations have been created.'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invite</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created</TableHead>
                {isAdmin ? <TableHead className="w-[56px]" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((row) => {
                const status = tokenStatus(row.token)
                return (
                  <TableRow key={row.token.id}>
                    <TableCell className="font-mono text-xs">{row.token.tokenPrefix}…</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{row.token.role}</Badge></TableCell>
                    <TableCell className="text-ink-muted">{row.token.note || '—'}</TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                    <TableCell>{row.createdByName || '—'}</TableCell>
                    <TableCell className="text-xs text-ink-muted">{new Date(row.token.createdAt).toLocaleDateString()}</TableCell>
                    {isAdmin ? (
                      <TableCell>
                        {!row.token.usedAt ? (
                          <Button variant="ghost" size="icon" onClick={() => handleRevoke(row.token.id)} disabled={revoking === row.token.id} aria-label="Revoke invitation">
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
