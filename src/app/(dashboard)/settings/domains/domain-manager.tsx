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
          hint="Domains verified for this organization and available to project routes"
          action={canManage ? (
            <Button variant="primary" size="sm" onClick={openAddDialog}>
              <Plus />
              Add domain
            </Button>
          ) : undefined}
        />

        <div className="flex items-start gap-2.5 border-b border-line bg-sunken px-4 py-3">
          <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
          <div className="space-y-0.5 text-[12.5px] leading-relaxed text-ink-soft">
            <p>
              Verification is a one-time DNS check. For each pending domain, add the TXT record shown below at your DNS provider
              {canManage ? ', then click Check verification after it propagates.' : '. An organization admin can check it after it propagates.'}
            </p>
            <p className="text-ink-muted">
              Bower never creates or changes DNS records. Hostnames, TLS, and paths are configured from project routes.
            </p>
          </div>
        </div>

        {domains.length === 0 ? (
          <EmptyState
            icon={<Globe2 className="h-4 w-4" />}
            title="No managed domains"
            body="Add a domain to verify ownership. Once verified, it can be used when creating project routes."
            action={canManage ? (
              <Button variant="primary" size="sm" onClick={openAddDialog}>
                <Plus />
                Add domain
              </Button>
            ) : undefined}
          />
        ) : (
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Routes</TableHead>
                <TableHead className="w-[420px] min-w-[380px]">DNS verification</TableHead>
                <TableHead className="w-[64px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((item) => {
                const recordName = `_bower.${item.domain}`
                const recordValue = `bower-verification=${item.verificationToken}`
                const isVerifying = busy === `verify:${item.id}`
                const isDeleting = busy === `delete:${item.id}`
                const isInUse = item.usage.length > 0

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
                        {item.verifiedAt ? 'Verified' : 'Pending verification'}
                      </Badge>
                    </TableCell>
                    <TableCell className="nums text-[13px] text-ink-soft">{item.usage.length}</TableCell>
                    <TableCell>
                      {item.verifiedAt ? (
                        <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                          <Check className="h-3.5 w-3.5 text-brand-500" />
                          DNS ownership verified
                        </div>
                      ) : (
                        <div className="space-y-2.5 py-0.5">
                          <p className="text-[11.5px] text-ink-muted">Create this record at your DNS provider:</p>
                          <div className="grid grid-cols-[40px_minmax(0,1fr)_28px] items-center gap-x-2 gap-y-1.5">
                            <span className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Type</span>
                            <code className="font-mono text-[11.5px] text-ink-soft">TXT</code>
                            <span aria-hidden="true" />

                            <span className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Name</span>
                            <code className="min-w-0 truncate rounded-md bg-sunken px-2 py-1 font-mono text-[11px] text-ink-soft" title={recordName}>
                              {recordName}
                            </code>
                            <IconButton
                              className="h-7 w-7"
                              label="Copy TXT record name"
                              onClick={() => copy(recordName, `name:${item.id}`)}
                            >
                              {copied === `name:${item.id}` ? <Check /> : <Copy />}
                            </IconButton>

                            <span className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Value</span>
                            <code className="min-w-0 truncate rounded-md bg-sunken px-2 py-1 font-mono text-[11px] text-ink-soft" title={recordValue}>
                              {recordValue}
                            </code>
                            <IconButton
                              className="h-7 w-7"
                              label="Copy TXT record value"
                              onClick={() => copy(recordValue, `value:${item.id}`)}
                            >
                              {copied === `value:${item.id}` ? <Check /> : <Copy />}
                            </IconButton>
                          </div>
                          {canManage ? (
                            <Button
                              size="sm"
                              disabled={isVerifying}
                              onClick={() => verifyDomain(item.id)}
                            >
                              <RefreshCw className={isVerifying ? 'animate-spin' : undefined} />
                              {isVerifying ? 'Checking…' : 'Check verification'}
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {canManage ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <IconButton
                                label={isInUse ? 'Remove project routes before deleting this domain' : 'Delete domain'}
                                disabled={isDeleting || isInUse}
                              >
                                <Trash2 />
                              </IconButton>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {item.domain}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes the domain from Bower. DNS records are left untouched.
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

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add domain</DialogTitle>
            <DialogDescription>
              Add a domain you control. Bower will give you a TXT record to verify ownership.
            </DialogDescription>
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
                    Use <span className="font-mono">internal.example.com</span> if you only want to manage that delegated subtree.
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
