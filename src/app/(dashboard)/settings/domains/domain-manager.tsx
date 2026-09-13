'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, Copy, Globe2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  createOrganizationDomainAction,
  deleteOrganizationDomainAction,
  verifyOrganizationDomainAction,
} from '@/lib/actions/domains'
import { Badge } from '@/components/ui/badge'
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
import { EmptyState, InlineNotice } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type DomainRow = {
  id: string
  domain: string
  verificationToken: string
  verifiedAt: string | null
  usage: Array<{
    routeId: string
    hostname: string
    projectName: string
    projectSlug: string
    environmentName: string
  }>
}

export function DomainManager({ domains, canManage }: { domains: DomainRow[]; canManage: boolean }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [domain, setDomain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  function openAddDialog() {
    setError(null)
    setAdding(true)
  }

  async function addDomain(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusy('add')
    const result = await createOrganizationDomainAction(domain)
    setBusy(null)
    if (result.error) return setError(result.error)
    setAdding(false)
    setDomain('')
    router.refresh()
  }

  async function verifyDomain(id: string) {
    setError(null)
    setBusy(`verify:${id}`)
    const result = await verifyOrganizationDomainAction(id)
    setBusy(null)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  async function deleteDomain(id: string) {
    setError(null)
    setBusy(`delete:${id}`)
    const result = await deleteOrganizationDomainAction(id)
    setBusy(null)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  async function copy(value: string, id: string) {
    await navigator.clipboard.writeText(value)
    setCopied(id)
    window.setTimeout(() => setCopied((current) => current === id ? null : current), 1600)
  }

  return (
    <div className="space-y-4">
      {error && !adding ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

      <Panel>
        <PanelHeader
          title="Managed domains"
          hint="Organization-owned DNS namespaces available to project routes"
          action={canManage ? (
            <Button variant="primary" size="sm" onClick={openAddDialog}>
              <Plus />
              Add domain
            </Button>
          ) : undefined}
        />
        {domains.length === 0 ? (
          <EmptyState
            icon={<Globe2 className="h-4 w-4" />}
            title="No managed domains"
            body="Add a domain here first. Once verified, project admins can use it for routes."
            action={canManage ? (
              <Button variant="primary" size="sm" onClick={openAddDialog}>
                Add domain
              </Button>
            ) : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Routes</TableHead>
                <TableHead className="w-[220px]">Verification</TableHead>
                <TableHead className="w-[96px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((item) => {
                const recordName = `_bower.${item.domain}`
                const recordValue = `bower-verification=${item.verificationToken}`
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-mono text-[12.5px] font-medium text-ink">{item.domain}</div>
                      {item.usage.length ? (
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-2xs text-ink-muted">
                          {item.usage.slice(0, 2).map((usage) => (
                            <Link
                              key={usage.routeId}
                              href={`/projects/${usage.projectSlug}/routes`}
                              className="hover:text-ink"
                            >
                              {usage.projectName} · {usage.environmentName}
                            </Link>
                          ))}
                          {item.usage.length > 2 ? <span>+{item.usage.length - 2} more</span> : null}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.verifiedAt ? 'success' : 'warning'}>
                        {item.verifiedAt ? 'Verified' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="nums text-[13px] text-ink-soft">{item.usage.length}</TableCell>
                    <TableCell>
                      {item.verifiedAt ? (
                        <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                          <Check className="h-3.5 w-3.5 text-brand-500" />
                          Ownership confirmed
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <code className="min-w-0 truncate font-mono text-[11px] text-ink-soft" title={recordName}>
                              {recordName}
                            </code>
                            <IconButton label="Copy record name" onClick={() => copy(recordName, `name:${item.id}`)}>
                              {copied === `name:${item.id}` ? <Check /> : <Copy />}
                            </IconButton>
                          </div>
                          <div className="flex items-center gap-1">
                            <code className="min-w-0 truncate font-mono text-[11px] text-ink-muted" title={recordValue}>
                              {recordValue}
                            </code>
                            <IconButton label="Copy record value" onClick={() => copy(recordValue, `value:${item.id}`)}>
                              {copied === `value:${item.id}` ? <Check /> : <Copy />}
                            </IconButton>
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {!item.verifiedAt && canManage ? (
                          <IconButton
                            label="Check verification"
                            disabled={busy === `verify:${item.id}`}
                            onClick={() => verifyDomain(item.id)}
                          >
                            <RefreshCw className={busy === `verify:${item.id}` ? 'animate-spin' : undefined} />
                          </IconButton>
                        ) : null}
                        {canManage ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <IconButton label="Delete domain" disabled={busy === `delete:${item.id}`}>
                                <Trash2 />
                              </IconButton>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {item.domain}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  The domain can only be removed when no project routes rely on it. DNS records are never changed by Bower.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="border border-danger-200 bg-surface text-danger-500 hover:bg-danger-50"
                                  onClick={() => deleteDomain(item.id)}
                                >
                                  Delete domain
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <InlineNotice tone="neutral" icon={<Globe2 className="h-4 w-4" />}>
        Bower verifies ownership with a TXT record under{' '}
        <span className="font-mono text-[11.5px] text-ink-soft">_bower</span>. It does not create, modify, or delete DNS records. Project routes remain responsible for the hostname, target service, TLS, and path configuration.
      </InlineNotice>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add domain</DialogTitle>
            <DialogDescription>Add an apex or delegated DNS namespace owned by this organization.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addDomain}>
            <DialogBody>
              <div className="space-y-4">
                {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    value={domain}
                    onChange={(event) => setDomain(event.target.value)}
                    placeholder="example.com"
                    className="font-mono text-[12.5px]"
                    autoComplete="off"
                    required
                  />
                  <p className="text-xs leading-relaxed text-ink-muted">
                    Use <span className="font-mono">internal.example.com</span> if you only want Bower to control that subtree.
                  </p>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" disabled={busy === 'add'}>Cancel</Button>
              </DialogClose>
              <Button variant="primary" type="submit" disabled={busy === 'add'}>
                {busy === 'add' ? 'Adding…' : 'Add domain'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
