'use client'

import { useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { createApiKeyAction, revokeApiKeyAction } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogBody, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Copy, Check, KeyRound } from 'lucide-react'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatDate } from '@/lib/format'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
}

export function ApiKeysSection({ keys }: { keys: ApiKey[] }) {
  const { toast } = useFeedback()
  const [open, setOpen] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

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

  async function handleCopy() {
    if (newKey) {
      try {
        await navigator.clipboard.writeText(newKey)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast({ tone: 'success', title: 'API key copied.' })
      } catch {
        toast({ tone: 'error', title: 'Could not copy API key.' })
      }
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>API keys</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { if (loading) return; setOpen(v); setError(null); if (!v) { setNewKey(null); setCopied(false) } }}>
          <DialogTrigger asChild>
            <Button variant="primary" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
            </DialogHeader>
              {newKey ? (<>
              <DialogBody>
                <div className="space-y-3">
                  <p className="text-sm text-ink-muted">Copy this key now. It will not be shown again.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-sunken px-3 py-2 font-mono text-xs break-all">{newKey}</code>
                    <Button variant="default" size="icon" onClick={handleCopy} aria-label="Copy API key">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </DialogBody><DialogFooter><Button variant="primary" onClick={() => { setOpen(false); setNewKey(null) }}>Done</Button></DialogFooter></>) : (
                <form onSubmit={handleCreate}>
                  <DialogBody className="space-y-4">
                  {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Name</Label>
                    <Input id="keyName" name="name" placeholder="CI deploy key" required />
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
      <CardContent>
        {keys.length === 0 ? (
          <EmptyState icon={<KeyRound className="size-4" />} title="No API keys" body="Create a key to authenticate automation with Bower." />
        ) : (
          <div className="overflow-x-auto"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
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
      <TableCell className="text-ink-muted">
        {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : 'Never'}
      </TableCell>
      <TableCell className="text-ink-muted">
        {formatDate(apiKey.createdAt)}
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
