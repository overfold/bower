'use client'

import { useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { createAutomationApiKeyAction, revokeApiKeyAction } from '@/lib/actions/settings'
import { API_KEY_SCOPES, type ApiKeyScope } from '@/lib/api-key-scopes'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogBody, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, KeyRound } from 'lucide-react'
import { FieldError, InlineNotice, useFeedback } from '@/components/ui/feedback'
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
  projectId: string | null
  environmentId: string | null
  scopes: string[]
  expiresAt: string | null
}

interface ProjectChoice {
  id: string
  name: string
  canWrite: boolean
  environments: { id: string; name: string }[]
}

export function ApiKeysSection({ keys, projects }: { keys: ApiKey[]; projects: ProjectChoice[] }) {
  const [open, setOpen] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [scopeError, setScopeError] = useState(false)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const project = projects.find((item) => item.id === projectId)
  const [environmentId, setEnvironmentId] = useState(projects[0]?.environments[0]?.id ?? '')
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['read'])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setScopeError(false)
    if (!scopes.length) {
      setScopeError(true)
      document.getElementById('keyScope-read')?.focus()
      return
    }
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const name = String(formData.get('name') ?? '')
    try {
      const result = await createAutomationApiKeyAction({ name, projectId, environmentId, scopes,
        expiresAt: new Date(Date.now() + Number(formData.get('lifetime')) * 3600_000).toISOString() })
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
      <CardHeader title="API keys" hint="Scoped, expiring keys for scripts, CI and MCP to call Bower as you." action={
        <Dialog open={open} onOpenChange={(v) => { if (loading) return; setOpen(v); setError(null); setScopeError(false); if (v) setScopes(['read']); else setNewKey(null) }}>
          <DialogTrigger asChild>
            <Button variant="primary" size="sm">
              <Plus />
              New key
            </Button>
          </DialogTrigger>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>{newKey ? 'API key created' : 'Create API key'}</DialogTitle>
              <DialogDescription>{newKey ? 'Copy this key before closing this dialog.' : 'Choose one project and environment, only the permissions needed, and an expiration.'}</DialogDescription>
            </DialogHeader>
              {newKey ? (<>
              <DialogBody>
                <InlineNotice tone="warn" className="mb-4">Copy this key now. You won’t see it again.</InlineNotice>
                <OneTimeSecret label="API key" value={newKey} />
              </DialogBody><DialogFooter><Button variant="primary" onClick={() => { setOpen(false); setNewKey(null) }}>Done</Button></DialogFooter></>) : (
                <form onSubmit={handleCreate}>
                  <DialogBody className="space-y-4">
                  {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Name</Label>
                    <Input id="keyName" name="name" maxLength={128} required />
                    <p className="text-xs text-ink-muted">Use a name that identifies its purpose, for example “CI deploy key”.</p>
                  </div>
                  {projects.length === 0 ? <InlineNotice tone="warn">You need project access in the selected organization before creating a key.</InlineNotice> : null}
                  <div className="space-y-2">
                    <Label htmlFor="keyProject">Project</Label>
                    <Select value={projectId} onValueChange={(id) => { setProjectId(id); setEnvironmentId(projects.find((item) => item.id === id)?.environments[0]?.id ?? ''); setScopes(['read']) }}>
                      <SelectTrigger id="keyProject"><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keyEnvironment">Environment</Label>
                    <Select value={environmentId} onValueChange={setEnvironmentId}>
                      <SelectTrigger id="keyEnvironment"><SelectValue placeholder="Select environment" /></SelectTrigger>
                      <SelectContent>{project?.environments.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-medium">Permissions</legend>
                    {API_KEY_SCOPES.map((scope) => <div key={scope} className="flex items-center gap-2">
                      <Checkbox id={`keyScope-${scope}`} checked={scopes.includes(scope)} disabled={scope !== 'read' && !project?.canWrite} aria-invalid={scopeError} aria-describedby={scopeError ? 'keyScopes-error' : undefined}
                        onCheckedChange={(checked) => { setScopeError(false); setScopes((current) => checked === true ? [...current, scope] : current.filter((value) => value !== scope)) }} />
                      <Label htmlFor={`keyScope-${scope}`}>{scope === 'read' ? 'Read diagnosis, logs and metrics' : scope === 'deploy' ? 'Deploy' : scope === 'restart' ? 'Restart' : 'Roll back'}</Label>
                    </div>)}
                    {scopeError ? <div id="keyScopes-error"><FieldError>Select at least one permission.</FieldError></div> : null}
                    <p className="text-xs text-ink-muted">Writes require your current deployer or admin access. Read access includes application logs, which may contain sensitive data.</p>
                  </fieldset>
                  <div className="space-y-2">
                    <Label htmlFor="keyLifetime">Expires after</Label>
                    <Select name="lifetime" defaultValue="24">
                      <SelectTrigger id="keyLifetime"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="1">1 hour</SelectItem><SelectItem value="24">1 day</SelectItem><SelectItem value="168">7 days</SelectItem><SelectItem value="720">30 days</SelectItem></SelectContent>
                    </Select>
                  </div>
                  </DialogBody>
                  <DialogFooter>
                  <Button type="button" disabled={loading} onClick={() => setOpen(false)}>Cancel</Button>
                  <Button variant="primary" type="submit" loading={loading} disabled={!environmentId}>Create key</Button>
                  </DialogFooter>
                </form>
              )}
          </DialogContent>
        </Dialog>
      } />
      <CardContent className={keys.length ? 'p-0' : undefined}>
        {keys.length === 0 ? (
          <EmptyState icon={<KeyRound className="size-4" />} title="No API keys" body="Create a key to authenticate automation with Bower." />
        ) : (
          <div className="overflow-x-auto"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="text-right">Expires</TableHead>
                <TableHead className="text-right">Last used</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <RevokeableRow key={k.id} apiKey={k} project={projects.find((item) => item.id === k.projectId)} />
              ))}
            </TableBody>
          </Table></div>
        )}
      </CardContent>
    </Card>
  )
}

function RevokeableRow({ apiKey, project }: { apiKey: ApiKey; project?: ProjectChoice }) {
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
      toast({ tone: 'success', title: 'API key revoked' })
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
      <TableCell className="max-w-xs text-xs">
        <div className="break-words">{apiKey.projectId ? `${project?.name ?? apiKey.projectId} / ${project?.environments.find((item) => item.id === apiKey.environmentId)?.name ?? apiKey.environmentId}` : 'Organization-wide (legacy)'}</div>
        <div className="text-ink-muted">{apiKey.scopes.join(', ')}</div>
      </TableCell>
      <TableCell className="text-right text-ink-muted">
        {apiKey.expiresAt ? <><Time value={apiKey.expiresAt} />{new Date(apiKey.expiresAt) <= new Date() ? <div className="text-xs text-danger-500">Expired</div> : null}</> : 'No expiration (legacy)'}
      </TableCell>
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
            {error ? <InlineNotice tone="danger" className="mx-5">{error}</InlineNotice> : null}
            <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={revoke} disabled={pending} aria-busy={pending}>{pending ? 'Revoking…' : 'Revoke API key'}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}
