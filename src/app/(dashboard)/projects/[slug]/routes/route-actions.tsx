'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { Plus, Info } from 'lucide-react'
import { createManagedRouteAction, deleteManagedRouteAction, updateManagedRouteAction } from '@/lib/actions/routes'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RowActions, RowActionItem, RowActionSeparator } from '@/components/ui/row-actions'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type Option = { id: string; name: string; port: number; portSource: string }
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
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [port, setPort] = useState(services[0]?.port ?? 80)
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
        New route
      </Button>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Create route</DialogTitle>
          <DialogDescription>
            Bind a hostname from an organization-verified domain to a service in this project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody>
            <div className="space-y-4">
              {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

              <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 font-mono text-sm text-ink">
                <span className={prefix.trim() ? undefined : 'text-ink-muted'}>{prefix.trim() ? preview : `<prefix>.${selectedDomain?.domain ?? 'example.com'}`}</span> → {services.find((service) => service.id === serviceId)?.name ?? 'service'} on port {port}
              </div>

              <fieldset className="space-y-4"><legend className="mb-3 text-sm font-semibold text-ink">Destination</legend>

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
                  <div className="flex overflow-hidden rounded-lg border border-line-strong bg-surface focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500"><Input
                    id="hostnamePrefix"
                    name="hostnamePrefix"
                    value={prefix}
                    onChange={(event) => setPrefix(event.target.value)}
                    className="min-w-0 rounded-none border-0 font-mono text-sm focus-visible:ring-0"
                    autoComplete="off"
                  /><span className="flex shrink-0 items-center border-l border-line bg-sunken px-3 font-mono text-xs text-ink-muted">.{selectedDomain?.domain}</span></div>
                </div>
              </div>

              <input type="hidden" name="environmentId" value={environmentId} />
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <div className="space-y-2">
                  <Label htmlFor="serviceId">Target service</Label>
                  <Select name="serviceId" value={serviceId} onValueChange={(value) => { setServiceId(value); setPort(services.find((service) => service.id === value)?.port ?? 80) }} required>
                    <SelectTrigger id="serviceId"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Label htmlFor="port">Port</Label><TooltipProvider><Tooltip><TooltipTrigger asChild><button type="button" aria-label="Default port source" className="rounded-md text-ink-muted focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"><Info className="size-3.5" /></button></TooltipTrigger><TooltipContent>{services.find((service) => service.id === serviceId)?.portSource}</TooltipContent></Tooltip></TooltipProvider></div>
                  <Input id="port" name="port" type="number" min={1} max={65535} value={port} onChange={(event) => setPort(Number(event.target.value))} required />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pathPrefix" optional>Path prefix</Label>
                  <Input id="pathPrefix" name="pathPrefix" defaultValue="/" className="font-mono text-sm" />
                </div>
              </div>
              </fieldset>

              <fieldset className="space-y-4"><legend className="mb-3 text-sm font-semibold text-ink">Security</legend>
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
                  <Label htmlFor="rateLimit" optional>Rate limit</Label>
                  <div className="relative"><Input id="rateLimit" name="rateLimit" type="number" min={1} className="pr-14" /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-ink-muted">req/s</span></div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="protectionMode">Access protection</Label>
                  <Select name="protectionMode" value={protectionMode} onValueChange={setProtectionMode}>
                    <SelectTrigger id="protectionMode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Public</SelectItem>
                      <SelectItem value="password">Password</SelectItem>
                      <SelectItem value="bower_auth">Bower account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                {protectionMode === 'password' ? (
                  <div className="space-y-2">
                    <Label htmlFor="routePassword">Route password</Label>
                    <Input id="routePassword" name="routePassword" type="password" minLength={8} required autoComplete="new-password" />
                    <p className="text-2xs text-ink-muted">Visitors enter this password on a Bower page.</p>
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-ink-muted">
                    {protectionMode === 'bower_auth'
                      ? 'Only Bower users with Viewer, Deployer, or Admin access to this project can continue.'
                      : 'Anyone who can reach this hostname can access the service.'}
                  </p>
                )}
                </div>
              </div>
              </fieldset>
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

type EditableRoute = {
  id: string; serviceId: string; domain: string; pathPrefix: string; port: number; tlsMode: 'auto' | 'custom' | 'none'
  protectionMode: 'none' | 'password' | 'bower_auth'; rateLimit: number | null
  headers: unknown; responseHeaders: unknown; redirects: unknown
  tlsCertSecret: string | null; tlsKeySecret: string | null
}

function keyValueLines(value: unknown) {
  return Object.entries((value ?? {}) as Record<string, string>).map(([key, item]) => `${key}=${item}`).join('\n')
}

function redirectLines(value: unknown) {
  return (Array.isArray(value) ? value : []).map((item: { from?: string; to?: string; code?: number }) => `${item.from ?? ''} ${item.to ?? ''} ${item.code ?? 308}`).join('\n')
}

export function RouteActions(props: {
  projectId: string
  route: EditableRoute
  services: { id: string; name: string }[]
}) {
  const [action, setAction] = useState<'edit' | 'delete' | null>(null)

  return (
    <>
      <RowActions name={props.route.domain}>
        <RowActionItem onSelect={() => setAction('edit')}>Edit route</RowActionItem>
        <RowActionSeparator />
        <RowActionItem className="text-danger-600 focus:text-danger-600" onSelect={() => setAction('delete')}>Delete</RowActionItem>
      </RowActions>
      <EditRouteDialog {...props} open={action === 'edit'} onOpenChange={(open) => setAction(open ? 'edit' : null)} />
      <DeleteRouteButton projectId={props.projectId} routeId={props.route.id} hostname={props.route.domain} open={action === 'delete'} onOpenChange={(open) => setAction(open ? 'delete' : null)} />
    </>
  )
}

function EditRouteDialog({
  projectId,
  route,
  services,
  open,
  onOpenChange,
}: {
  projectId: string
  route: EditableRoute
  services: { id: string; name: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [mode, setMode] = useState(route.protectionMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateManagedRouteAction(projectId, route.id, new FormData(event.currentTarget))
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not update route.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (next) { setMode(route.protectionMode); setError(null) } }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit route</DialogTitle>
          <DialogDescription>Update the hostname, traffic rules, and access protection.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody>
            <div className="space-y-4">
              {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2"><Label htmlFor={`service-${route.id}`}>Service</Label><Select name="serviceId" defaultValue={route.serviceId}><SelectTrigger id={`service-${route.id}`}><SelectValue /></SelectTrigger><SelectContent>{services.map((service) => <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor={`domain-${route.id}`}>Hostname</Label><Input id={`domain-${route.id}`} name="domain" defaultValue={route.domain} required mono /></div>
                <div className="space-y-2"><Label htmlFor={`path-${route.id}`}>Path prefix</Label><Input id={`path-${route.id}`} name="pathPrefix" defaultValue={route.pathPrefix} required mono /></div>
                <div className="space-y-2"><Label htmlFor={`port-${route.id}`}>Port</Label><Input id={`port-${route.id}`} name="port" type="number" min={1} max={65535} defaultValue={route.port} required /></div>
                <div className="space-y-2"><Label htmlFor={`tls-${route.id}`}>TLS</Label><Select name="tlsMode" defaultValue={route.tlsMode}><SelectTrigger id={`tls-${route.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Automatic HTTPS</SelectItem><SelectItem value="none">HTTP only</SelectItem>{route.tlsMode === 'custom' ? <SelectItem value="custom">Custom certificate</SelectItem> : null}</SelectContent></Select><input type="hidden" name="tlsCertSecret" value={route.tlsCertSecret ?? ''} /><input type="hidden" name="tlsKeySecret" value={route.tlsKeySecret ?? ''} /></div>
                <div className="space-y-2"><Label htmlFor={`limit-${route.id}`} optional>Rate limit</Label><Input id={`limit-${route.id}`} name="rateLimit" type="number" min={1} defaultValue={route.rateLimit ?? ''} /></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`protection-${route.id}`}>Access protection</Label>
                <Select name="protectionMode" value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
                  <SelectTrigger id={`protection-${route.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Public</SelectItem>
                    <SelectItem value="password">Password</SelectItem>
                    <SelectItem value="bower_auth">Bower account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mode === 'password' ? (
                <div className="space-y-2">
                  <Label htmlFor={`password-${route.id}`}>{route.protectionMode === 'password' ? 'New password (optional)' : 'Password'}</Label>
                  <Input id={`password-${route.id}`} name="routePassword" type="password" minLength={8} required={route.protectionMode !== 'password'} autoComplete="new-password" />
                  <p className="text-xs text-ink-muted">{route.protectionMode === 'password' ? 'Leave blank to keep the current password. ' : ''}Visitors enter this password on a Bower page.</p>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor={`request-${route.id}`} optional>Request headers</Label><Textarea id={`request-${route.id}`} name="requestHeaders" defaultValue={keyValueLines(route.headers)} mono /><p className="text-xs text-ink-muted">One header per line, for example <span className="font-mono">X-Header=value</span>.</p></div><div className="space-y-2"><Label htmlFor={`response-${route.id}`} optional>Response headers</Label><Textarea id={`response-${route.id}`} name="responseHeaders" defaultValue={keyValueLines(route.responseHeaders)} mono /><p className="text-xs text-ink-muted">One header per line, for example <span className="font-mono">X-Header=value</span>.</p></div></div>
              <div className="space-y-2"><Label htmlFor={`redirects-${route.id}`} optional>Redirects</Label><Textarea id={`redirects-${route.id}`} name="redirects" defaultValue={redirectLines(route.redirects)} mono /><p className="text-xs text-ink-muted">One redirect per line: source, destination, and status code. For example, <span className="font-mono">/old /new 308</span>.</p></div>
              {mode === 'bower_auth' ? (
                <p className="text-xs leading-5 text-ink-muted">Users sign in to Bower and must have Viewer, Deployer, or Admin access to this project.</p>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button type="button" disabled={busy}>Cancel</Button></DialogClose>
            <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save route'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteRouteButton({
  projectId,
  routeId,
  hostname,
  open,
  onOpenChange,
}: {
  projectId: string
  routeId: string
  hostname: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove(event: React.MouseEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await deleteManagedRouteAction(projectId, routeId)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not delete route.'))
    } finally {
      setBusy(false)
    }
  }

  return (
      <AlertDialog open={open} onOpenChange={(next) => { if (!busy) { onOpenChange(next); if (next) setError(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete route {hostname}?</AlertDialogTitle>
            <AlertDialogDescription>
              Traffic to <span className="font-mono text-xs text-ink">{hostname}</span> will stop being routed by this project.
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
  )
}
