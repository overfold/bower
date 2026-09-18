'use client'

import { useState, useTransition } from 'react'
import { createApiKeyAction, revokeApiKeyAction } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Copy, Check } from 'lucide-react'

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
  const [copied, setCopied] = useState(false)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const name = String(formData.get('name') ?? '')
    const result = await createApiKeyAction(name)
    if (result?.error) {
      setError(result.error)
    } else if (result?.token) {
      setNewKey(result.token)
    }
    setLoading(false)
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>API keys</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setNewKey(null); setError(null) } }}>
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
            <DialogBody>
              {newKey ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink-muted">Copy this key now. It will not be shown again.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-sunken px-3 py-2 font-mono text-xs break-all">{newKey}</code>
                    <Button variant="default" size="icon" onClick={handleCopy} aria-label="Copy API key">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button variant="primary" className="w-full" onClick={() => { setOpen(false); setNewKey(null) }}>Done</Button>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-4">
                  {error && <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div>}
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Name</Label>
                    <Input id="keyName" name="name" placeholder="CI deploy key" required />
                  </div>
                  <Button variant="primary" type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating…' : 'Create key'}
                  </Button>
                </form>
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <p className="text-sm text-ink-muted">No API keys.</p>
        ) : (
          <Table>
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
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function RevokeableRow({ apiKey }: { apiKey: ApiKey }) {
  const [pending, startTransition] = useTransition()

  return (
    <TableRow>
      <TableCell>{apiKey.name}</TableCell>
      <TableCell className="font-mono text-xs">{apiKey.keyPrefix}...</TableCell>
      <TableCell className="text-ink-muted">
        {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : 'Never'}
      </TableCell>
      <TableCell className="text-ink-muted">
        {new Date(apiKey.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => revokeApiKeyAction(apiKey.id))}
          aria-label={`Revoke ${apiKey.name}`}
        >
          <Trash2 className="h-3.5 w-3.5 text-ink-muted" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
