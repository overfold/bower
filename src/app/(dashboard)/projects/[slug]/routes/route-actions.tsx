'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { createManagedRouteAction, deleteManagedRouteAction, updateRouteProtectionAction } from '@/lib/actions/routes'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button, IconButton } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InlineNotice } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Option = { id: string; name: string }
type ManagedDomain = { id: string; domain: string }

export function AddRouteDialog({
  projectId,
  environmentId,
  services,
  domains,
}: {
  projectId: string
  environmentId: string
  services: Option[]
  domains: ManagedDomain[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [domainId, setDomainId] = useState(domains[0]?.id ?? '')
  const [prefix, setPrefix] = useState('')
  const [protectionMode, setProtectionMode] = useState('none')
  const selectedDomain = useMemo(() => domains.find((domain) => domain.id === domainId), [domainId, domains])
  const preview = selectedDomain
    ? (prefix.trim() ? `${prefix.trim().replace(/^\.+|\.+$/g, '')}.${selectedDomain.domain}` : selectedDomain.domain)
    : ''

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createManagedRouteAction(projectId, new FormData(event.currentTarget))
      setOpen(false)
      setPrefix('')
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not create route.'))
    } finally {
      setBusy(false)
    }
  }

  if (!domains.length) {
    return (
      <Button asChild size="sm">
        <Link href="/settings/domains">Verify a domain first</Link>
      </Button>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setError(null)
      }}
    >
      <Button
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!services.length}
      >
        <Plus />
        Add route
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add route</DialogTitle>
          <DialogDescription>
            Bind a hostname from an organization-verified domain to a service in this project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody>
            <div className="space-y-4">
              {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="managedDomainId">Managed domain</Label>
                  <Select name="managedDomainId" value={domainId} onValueChange={setDomainId}>
                    <SelectTrigger id="managedDomainId"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {domains.map((domain) => (
                        <SelectItem key={domain.id} value={domain.id}>{domain.domain}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hostnamePrefix">Hostname prefix</Label>
                  <Input
                    id="hostnamePrefix"
                    name="hostnamePrefix"
                    value={prefix}
                    onChange={(event) => setPrefix(event.target.value)}
                    placeholder="api"
                    className="font-mono text-[12.5px]"
                    autoComplete="off"
                  />
                  <p className="truncate font-mono text-[11px] text-ink-muted">{preview || 'hostname'}</p>
                </div>
              </div>

              <input type="hidden" name="environmentId" value={environmentId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="serviceId">Target service</Label>
                  <Select name="serviceId" defaultValue={services[0]?.id} required>
                    <SelectTrigger id="serviceId"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pathPrefix">Path prefix</Label>
                  <Input id="pathPrefix" name="pathPrefix" defaultValue="/" className="font-mono text-[12.5px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input id="port" name="port" type="number" min={1} max={65535} defaultValue={8080} required />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tlsMode">TLS</Label>
                  <Select name="tlsMode" defaultValue="auto">
                    <SelectTrigger id="tlsMode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatic HTTPS</SelectItem>
                      <SelectItem value="none">HTTP only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rateLimit">Rate limit</Label>
                  <Input id="rateLimit" name="rateLimit" type="number" min={1} placeholder="Requests / second" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="protectionMode">Access protection</Label>
                  <Select name="protectionMode" value={protectionMode} onValueChange={setProtectionMode}>
                    <SelectTrigger id="protectionMode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Public</SelectItem>
                      <SelectItem value="password">Password</SelectItem>
                      <SelectItem value="bower_auth">Bower account (Viewer+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {protectionMode === 'password' ? (
                  <div className="space-y-2">
                    <Label htmlFor="routePassword">Route password</Label>
                    <Input id="routePassword" name="routePassword" type="password" minLength={8} required autoComplete="new-password" />
                    <p className="text-[11px] text-ink-muted">Visitors enter this password on a Bower page.</p>
                  </div>
                ) : (
                  <div className="flex items-end pb-1 text-xs leading-5 text-ink-muted">
                    {protectionMode === 'bower_auth'
                      ? 'Only Bower users with Viewer, Deployer, or Admin access to this project can continue.'
                      : 'Anyone who can reach this hostname can access the service.'}
                  </div>
                )}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" disabled={busy}>Cancel</Button>
            </DialogClose>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? 'Creating route…' : 'Create route'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RouteProtectionButton({
  projectId,
  routeId,
  hostname,
  currentMode,
}: {
  projectId: string
  routeId: string
  hostname: string
  currentMode: 'none' | 'password' | 'bower_auth'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState(currentMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateRouteProtectionAction(projectId, routeId, new FormData(event.currentTarget))
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not update route protection.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setMode(currentMode); setError(null) } }}>
      <IconButton label={`Configure protection for ${hostname}`} onClick={() => setOpen(true)}>
        <ShieldCheck />
      </IconButton>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Route protection</DialogTitle>
          <DialogDescription>Control access to <span className="font-mono text-[12px]">{hostname}</span> at the proxy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody>
            <div className="space-y-4">
              {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
              <div className="space-y-2">
                <Label htmlFor={`protection-${routeId}`}>Access protection</Label>
                <Select name="protectionMode" value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
                  <SelectTrigger id={`protection-${routeId}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Public</SelectItem>
                    <SelectItem value="password">Password</SelectItem>
                    <SelectItem value="bower_auth">Bower account (Viewer+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mode === 'password' ? (
                <div className="space-y-2">
                  <Label htmlFor={`password-${routeId}`}>{currentMode === 'password' ? 'New password (optional)' : 'Password'}</Label>
                  <Input id={`password-${routeId}`} name="routePassword" type="password" minLength={8} required={currentMode !== 'password'} autoComplete="new-password" />
                  <p className="text-xs text-ink-muted">{currentMode === 'password' ? 'Leave blank to keep the current password. ' : ''}Visitors enter this password on a Bower page.</p>
                </div>
              ) : null}
              {mode === 'bower_auth' ? (
                <p className="text-xs leading-5 text-ink-muted">Users sign in to Bower and must have Viewer, Deployer, or Admin access to this project.</p>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button type="button" disabled={busy}>Cancel</Button></DialogClose>
            <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save protection'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteRouteButton({
  projectId,
  routeId,
  hostname,
}: {
  projectId: string
  routeId: string
  hostname: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove(event: React.MouseEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await deleteManagedRouteAction(projectId, routeId)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not delete route.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <AlertDialog open={open} onOpenChange={(next) => { if (!busy) { setOpen(next); if (next) setError(null) } }}>
        <AlertDialogTrigger asChild>
          <IconButton label={`Delete route ${hostname}`} disabled={busy}>
            <Trash2 />
          </IconButton>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete route {hostname}?</AlertDialogTitle>
            <AlertDialogDescription>
              Traffic to <span className="font-mono text-[12px] text-ink">{hostname}</span> will stop being routed by this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <InlineNotice tone="danger" className="mx-5">{error}</InlineNotice> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              aria-busy={busy}
              onClick={remove}
            >
              {busy ? 'Deleting…' : 'Delete route'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
