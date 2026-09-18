'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ChevronDown, Plus, ShieldCheck, Trash2 } from 'lucide-react'
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

type Option = { id: string; name: string }
type ManagedDomain = { id: string; domain: string }

const selectClass = 'flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 pr-9 text-[13px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-enter focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100'

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
      setError(err instanceof Error ? err.message : 'Could not create route.')
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
                  <div className="relative">
                    <select
                      id="managedDomainId"
                      name="managedDomainId"
                      className={selectClass}
                      value={domainId}
                      onChange={(event) => setDomainId(event.target.value)}
                    >
                      {domains.map((domain) => (
                        <option key={domain.id} value={domain.id}>{domain.domain}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  </div>
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
                  <div className="relative">
                    <select id="serviceId" name="serviceId" className={selectClass} required>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>{service.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  </div>
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
                  <div className="relative">
                    <select id="tlsMode" name="tlsMode" className={selectClass} defaultValue="auto">
                      <option value="auto">Automatic HTTPS</option>
                      <option value="none">HTTP only</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rateLimit">Rate limit</Label>
                  <Input id="rateLimit" name="rateLimit" type="number" min={1} placeholder="Requests / second" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="protectionMode">Access protection</Label>
                  <div className="relative">
                    <select
                      id="protectionMode"
                      name="protectionMode"
                      className={selectClass}
                      value={protectionMode}
                      onChange={(event) => setProtectionMode(event.target.value)}
                    >
                      <option value="none">Public</option>
                      <option value="password">Password</option>
                      <option value="bower_auth">Bower account (Viewer+)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  </div>
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
      setError(err instanceof Error ? err.message : 'Could not update route protection.')
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
                <div className="relative">
                  <select id={`protection-${routeId}`} name="protectionMode" className={selectClass} value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
                    <option value="none">Public</option>
                    <option value="password">Password</option>
                    <option value="bower_auth">Bower account (Viewer+)</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                </div>
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await deleteManagedRouteAction(projectId, routeId)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete route.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? <span className="max-w-[180px] text-right text-2xs text-danger-500">{error}</span> : null}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <IconButton label={`Delete route ${hostname}`} disabled={busy}>
            <Trash2 />
          </IconButton>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete route?</AlertDialogTitle>
            <AlertDialogDescription>
              Traffic to <span className="font-mono text-[12px] text-ink">{hostname}</span> will stop being routed by this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="border border-danger-200 bg-surface text-danger-500 hover:bg-danger-50"
              onClick={remove}
            >
              Delete route
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
