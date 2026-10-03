'use client'

import { useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { createApiKeyAction, revokeApiKeyAction } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogBody, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, KeyRound } from 'lucide-react'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { OneTimeSecret } from '@/components/one-time-secret'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Time } from '@/components/time'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
}

export function ApiKeysSection({ keys }: { keys: ApiKey[] }) {
  const [open, setOpen] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const name = String(formData.get('name') ?? '')
    try {
      const result = await createApiKeyAction(name)
      if (result?.error) setError(result.error)
      else if (result?.token) setNewKey(result.token)
    } catch {
      setError('Could not create API key. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>API keys</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { if (loading) return; setOpen(v); setError(null); if (!v) setNewKey(null) }}>
          <DialogTrigger asChild>
            <Button variant="primary" size="sm">
              <Plus />
              New key
            </Button>
          </DialogTrigger>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>{newKey ? 'API key created' : 'Create API key'}</DialogTitle>
              {newKey ? <DialogDescription>Copy this key before closing this dialog.</DialogDescription> : null}
            </DialogHeader>
              {newKey ? (<>
              <DialogBody>
                <InlineNotice tone="warning" className="mb-4">Copy this key now. You won’t see it again.</InlineNotice>
                <OneTimeSecret label="API key" value={newKey} />
              </DialogBody><DialogFooter><Button variant="primary" onClick={() => { setOpen(false); setNewKey(null) }}>Done</Button></DialogFooter></>) : (
                <form onSubmit={handleCreate}>
                  <DialogBody className="space-y-4">
                  {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Name</Label>
                    <Input id="keyName" name="name" required />
                    <p className="text-xs text-ink-muted">Use a name that identifies its purpose, for example “CI deploy key”.</p>
                  </div>
                  </DialogBody>
                  <DialogFooter>
                  <Button type="button" disabled={loading} onClick={() => setOpen(false)}>Cancel</Button>
                  <Button variant="primary" type="submit" disabled={loading} aria-busy={loading}>
                    {loading ? 'Creating…' : 'Create key'}
                  </Button>
                  </DialogFooter>
                </form>
              )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className={keys.length ? 'p-0' : undefined}>
        {keys.length === 0 ? (
          <EmptyState icon={<KeyRound className="size-4" />} title="No API keys" body="Create a key to authenticate automation with Bower." />
        ) : (
          <div className="overflow-x-auto"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead className="text-right">Last used</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <RevokeableRow key={k.id} apiKey={k} />
              ))}
            </TableBody>
          </Table></div>
        )}
      </CardContent>
    </Card>
  )
}

function RevokeableRow({ apiKey }: { apiKey: ApiKey }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useFeedback()

  async function revoke(event: React.MouseEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await revokeApiKeyAction(apiKey.id)
      setOpen(false)
      toast({ tone: 'success', title: 'API key revoked.' })
    } catch (cause) {
      setError(actionErrorMessage(cause, 'Could not revoke API key.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <TableRow>
      <TableCell>{apiKey.name}</TableCell>
      <TableCell className="font-mono text-xs">{apiKey.keyPrefix}...</TableCell>
      <TableCell className="text-right text-ink-muted">
        {apiKey.lastUsedAt ? <Time value={apiKey.lastUsedAt} /> : 'Never'}
      </TableCell>
      <TableCell className="text-right text-ink-muted">
        <Time value={apiKey.createdAt} />
      </TableCell>
      <TableCell>
        <AlertDialog open={open} onOpenChange={(next) => { if (pending) return; setOpen(next); if (next) setError(null) }}>
          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" disabled={pending} aria-label={`Revoke ${apiKey.name}`}><Trash2 className="h-3.5 w-3.5 text-ink-muted" /></Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Revoke {apiKey.name}?</AlertDialogTitle><AlertDialogDescription>Clients using API key <span className="font-mono text-ink">{apiKey.keyPrefix}…</span> will immediately lose access. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            {error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}
            <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={revoke} disabled={pending} aria-busy={pending}>{pending ? 'Revoking…' : 'Revoke API key'}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}
