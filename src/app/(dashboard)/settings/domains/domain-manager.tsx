'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { Check, ChevronDown, Copy, Globe2, Plus, RefreshCw } from 'lucide-react'
import {
  createOrganizationDomainAction,
  deleteOrganizationDomainAction,
  verifyOrganizationDomainAction,
} from '@/lib/actions/domains'
import { Chip } from '@/components/ui/badge'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RowActions, RowActionItem, RowActionSeparator } from '@/components/ui/row-actions'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  async function deleteDomain(id: string, event: React.MouseEvent) {
    event.preventDefault()
    setDeleteError(null)
    setBusy(`delete:${id}`)
    try {
      const result = await deleteOrganizationDomainAction(id)
      if (result.error) {
        setDeleteError(result.error)
        return
      }
      setDeletingId(null)
      router.refresh()
    } catch (err) {
      setDeleteError(actionErrorMessage(err, 'Could not delete domain.'))
    } finally {
      setBusy(null)
    }
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
              New domain
            </Button>
          ) : undefined}
        />

        {domains.length === 0 ? (
          <EmptyState
            icon={<Globe2 className="h-4 w-4" />}
            title="No managed domains"
            body="Add a domain to verify ownership. Once verified, it can be used when creating project routes."
            action={canManage ? (
              <Button variant="primary" size="sm" onClick={openAddDialog}>
                <Plus />
                New domain
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
                <TableHead className="w-[64px]"><span className="sr-only">Actions</span></TableHead>
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
                  <Fragment key={item.id}>
                  <TableRow>
                    <TableCell>
                      <div className="font-mono text-sm font-medium text-ink">{item.domain}</div>
                    </TableCell>
                    <TableCell>
                      <Chip tone={item.verifiedAt ? 'success' : 'warn'} className="whitespace-nowrap">
                        {item.verifiedAt ? 'Verified' : 'Pending verification'}
                      </Chip>
                    </TableCell>
                    <TableCell className="nums text-sm text-ink-soft">
                      {item.usage.length ? (
                        <DropdownMenu><DropdownMenuTrigger className="text-link">{item.usage.length}</DropdownMenuTrigger><DropdownMenuContent align="start">{[...new Map(item.usage.map((usage) => [usage.projectSlug, usage])).values()].map((usage) => <DropdownMenuItem key={usage.projectSlug} asChild><Link href={`/projects/${usage.projectSlug}/routes`}>{usage.projectName} routes</Link></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
                      ) : '0'}
                    </TableCell>
                    <TableCell>
                      {!item.verifiedAt ? (
                        <button type="button" className="flex items-center gap-1 text-xs font-medium text-brand-700" aria-expanded={expandedId === item.id} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                          {expandedId === item.id ? 'Hide DNS record' : 'Show DNS record'}
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`} />
                        </button>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {canManage ? (
                          <AlertDialog
                            open={deletingId === item.id}
                            onOpenChange={(next) => {
                              if (!isDeleting) {
                                setDeletingId(next ? item.id : null)
                                setDeleteConfirmation('')
                                if (next) setDeleteError(null)
                              }
                            }}
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span tabIndex={isInUse ? 0 : undefined}>
                                    <RowActions name={item.domain}><RowActionSeparator /><AlertDialogTrigger asChild><RowActionItem className="text-danger-600 focus:text-danger-600" disabled={isDeleting || isInUse}>Delete</RowActionItem></AlertDialogTrigger></RowActions>
                                  </span>
                                </TooltipTrigger>
                                {isInUse ? <TooltipContent>Remove the {item.usage.length} {item.usage.length === 1 ? 'route' : 'routes'} using this domain first</TooltipContent> : null}
                              </Tooltip>
                            </TooltipProvider>
                            {isInUse ? <span className="sr-only">Remove project routes before deleting this domain.</span> : null}
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {item.domain}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes the domain from Bower. DNS records are left untouched. Type the domain <span className="font-mono text-ink">{item.domain}</span> to confirm.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="px-5 py-4"><Label htmlFor={`confirm-delete-${item.id}`}>Domain</Label><Input id={`confirm-delete-${item.id}`} className="mt-2 font-mono" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /></div>
                              {deleteError ? <InlineNotice tone="danger" className="mx-5">{deleteError}</InlineNotice> : null}
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={isDeleting || deleteConfirmation !== item.domain}
                                  aria-busy={isDeleting}
                                  onClick={(event) => deleteDomain(item.id, event)}
                                >
                                  {isDeleting ? 'Deleting…' : 'Delete domain'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                  {!item.verifiedAt && expandedId === item.id ? (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-sunken px-6 py-4">
                        <div className="space-y-3">
                          <p className="text-xs text-ink-muted">Add this TXT record at your DNS provider, then check verification. Bower never changes DNS records.</p>
                          <div className="grid max-w-3xl grid-cols-[48px_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
                            <span className="overline">Type</span>
                            <code className="font-mono text-2xs text-ink-soft">TXT</code>

                            <span className="overline">Name</span>
                            <div className="flex min-w-0 items-center gap-2">
                            <code className="min-w-0 truncate rounded-md bg-sunken px-2 py-1 font-mono text-2xs text-ink-soft" title={recordName}>
                              {recordName}
                            </code>
                            <IconButton
                              className="h-7 w-7 shrink-0"
                              label="Copy TXT record name"
                              onClick={() => copy(recordName, `name:${item.id}`)}
                            >
                              {copied === `name:${item.id}` ? <Check /> : <Copy />}
                            </IconButton>
                            </div>

                            <span className="overline">Value</span>
                            <div className="flex min-w-0 items-center gap-2">
                            <code className="min-w-0 truncate rounded-md bg-sunken px-2 py-1 font-mono text-2xs text-ink-soft" title={recordValue}>
                              {recordValue}
                            </code>
                            <IconButton
                              className="h-7 w-7 shrink-0"
                              label="Copy TXT record value"
                              onClick={() => copy(recordValue, `value:${item.id}`)}
                            >
                              {copied === `value:${item.id}` ? <Check /> : <Copy />}
                            </IconButton>
                            </div>
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
                      </TableCell>
                    </TableRow>
                  ) : null}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Create domain</DialogTitle>
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
                    aria-describedby="domain-help"
                    value={domain}
                    onChange={(event) => setDomain(event.target.value)}
                    className="font-mono text-sm"
                    autoComplete="off"
                    required
                  />
                  <p id="domain-help" className="text-xs leading-relaxed text-ink-muted">
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
                {busy === 'add' ? 'Creating…' : 'Create domain'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
