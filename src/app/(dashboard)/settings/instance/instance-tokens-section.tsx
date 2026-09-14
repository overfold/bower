'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Key, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createInstanceTokenAction, revokeInstanceTokenAction } from '@/lib/actions/settings'

interface TokenRow {
  token: {
    id: string
    tokenPrefix: string
    note: string | null
    usedAt: string | null
    createdAt: string
  }
  createdByName: string | null
}

export function InstanceTokensSection({ tokens }: { tokens: TokenRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await createInstanceTokenAction(
      (formData.get('note') as string | undefined) || undefined,
    )
    if (result?.error) setError(result.error)
    else if (result?.token) {
      setCreatedToken(result.token)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleRevoke(id: string) {
    setRevoking(id)
    await revokeInstanceTokenAction(id)
    router.refresh()
    setRevoking(null)
  }

  function handleClose() {
    setOpen(false)
    setCreatedToken(null)
    setError(null)
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Instance tokens</CardTitle>
          <p className="mt-0.5 text-xs text-ink-muted">API tokens for instance-level automation</p>
        </div>
        <Dialog open={open} onOpenChange={(value) => { if (!value) handleClose(); else setOpen(true) }}>
          <DialogTrigger asChild>
            <Button variant="primary" size="sm">
              <Plus className="h-4 w-4" />
              Create token
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create instance token</DialogTitle>
            </DialogHeader>
            {createdToken ? (
              <>
                <DialogBody>
                  <div className="space-y-3">
                    <p className="text-[13px] font-medium text-ink">Copy this token now. It will not be shown again.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-[12.5px] text-ink">
                        {createdToken}
                      </code>
                      <Button variant="default" size="icon" onClick={() => navigator.clipboard.writeText(createdToken)} aria-label="Copy token">
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
                    <Label htmlFor="token-note">Note <span className="font-normal text-ink-muted">(optional)</span></Label>
                    <Input id="token-note" name="note" placeholder="e.g. CI pipeline" />
                  </div>
                  {error ? <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div> : null}
                </DialogBody>
                <DialogFooter>
                  <Button variant="default" type="button" size="sm" onClick={handleClose} disabled={loading}>Cancel</Button>
                  <Button variant="primary" type="submit" size="sm" disabled={loading}>
                    {loading ? 'Creating…' : 'Create token'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {tokens.length === 0 ? (
          <EmptyState
            icon={<Key className="h-5 w-5" />}
            title="No instance tokens"
            body="Create a token for instance-level API access."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[56px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((row) => (
                <TableRow key={row.token.id}>
                  <TableCell className="font-mono text-xs">{row.token.tokenPrefix}…</TableCell>
                  <TableCell className="text-ink-muted">{row.token.note || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={row.token.usedAt ? 'secondary' : 'success'}>
                      {row.token.usedAt ? 'Used' : 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.createdByName || '—'}</TableCell>
                  <TableCell className="text-xs text-ink-muted">{new Date(row.token.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {!row.token.usedAt ? (
                      <Button variant="ghost" size="icon" onClick={() => handleRevoke(row.token.id)} disabled={revoking === row.token.id} aria-label="Revoke token">
                        <Trash2 className="h-4 w-4 text-ink-muted" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
