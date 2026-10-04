'use client'

import { useState, useTransition } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HardDrive, Info, Plus } from 'lucide-react'
import { deleteProjectVolumeAction, upsertProjectVolumeAction } from '@/lib/actions/project-volumes'
import { Button } from '@/components/ui/button'
import { RowActions, RowActionItem, RowActionSeparator } from '@/components/ui/row-actions'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InlineNotice } from '@/components/ui/feedback'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Volume = { id: string; name: string; hostPath: string }
type Usage = { volumeName: string; serviceName: string; serviceSlug: string; mountPath: string }

export function VolumeManager({ projectId, environmentId, volumes, usages, projectSlug, canManage, allowAbsoluteHostPaths }: {
  projectId: string
  environmentId: string
  volumes: Volume[]
  usages: Usage[]
  projectSlug: string
  canManage: boolean
  allowAbsoluteHostPaths: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Volume | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function edit(volume?: Volume) {
    setEditing(volume ?? null)
    setError(null)
    setOpen(true)
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(async () => {
      try {
        await upsertProjectVolumeAction(projectId, environmentId, data)
        setOpen(false)
        router.refresh()
      } catch (cause) {
        setError(actionErrorMessage(cause, 'Could not save volume.'))
      }
    })
  }

  function remove(volume: Volume, event: React.MouseEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await deleteProjectVolumeAction(projectId, environmentId, volume.id)
        setDeletingId(null)
        router.refresh()
      } catch (cause) {
        setError(actionErrorMessage(cause, 'Could not delete volume.'))
      }
    })
  }

  return (
    <Panel>
      <PanelHeader title={`${volumes.length} ${volumes.length === 1 ? 'volume' : 'volumes'}`} action={canManage ? <Button size="sm" variant="primary" onClick={() => edit()}><Plus />New volume</Button> : undefined} />
      {volumes.length === 0 ? (
        <EmptyState
          icon={<HardDrive className="h-4 w-4" />}
          title="No volumes"
          body={canManage ? 'Create a namespace-scoped volume, then attach it from a service’s Mounts tab.' : 'Project administrator access is required to create a volume.'}
          action={canManage ? <Button size="sm" variant="primary" onClick={() => edit()}><Plus />New volume</Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead><span className="inline-flex items-center gap-1">Storage path <TooltipProvider><Tooltip><TooltipTrigger aria-label="About storage paths"><Info className="size-3.5" /></TooltipTrigger><TooltipContent>The Trellis backing path where this volume’s data is stored. Paths beginning @/ are managed local storage.</TooltipContent></Tooltip></TooltipProvider></span></TableHead><TableHead>Storage</TableHead><TableHead className="w-14"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>{volumes.map((volume) => (
            <TableRow key={volume.id}>
              <TableCell className="font-mono text-xs font-medium">{volume.name}</TableCell>
              <TableCell className="font-mono text-xs text-ink-muted">{volume.hostPath}</TableCell>
              <TableCell className="text-ink-muted">{volume.hostPath.startsWith('@/') ? 'Managed local' : 'Host path'}</TableCell>
              <TableCell>{canManage && <RowActions name={volume.name}><RowActionItem onSelect={() => edit(volume)}>Edit</RowActionItem><RowActionSeparator /><RowActionItem className="text-danger-600 focus:text-danger-600" disabled={busy} onSelect={() => { setDeletingId(volume.id); setError(null) }}>Delete</RowActionItem></RowActions>}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
      {(() => {
        const volume = volumes.find((item) => item.id === deletingId)
        const mountedBy = volume ? usages.filter((usage) => usage.volumeName === volume.name) : []
        return <AlertDialog open={Boolean(volume)} onOpenChange={(next) => { if (!busy && !next) setDeletingId(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {volume?.name}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the volume definition for <span className="font-mono text-ink">{volume?.hostPath}</span>.</AlertDialogDescription></AlertDialogHeader>{mountedBy.length ? <InlineNotice tone="warn" className="mx-5"><p className="font-medium">Detach this volume before deleting it.</p><ul className="mt-2 space-y-1">{mountedBy.map((usage) => <li key={`${usage.serviceSlug}-${usage.mountPath}`}><Link className="text-link" href={`/projects/${projectSlug}/services/${usage.serviceSlug}/mounts`}>{usage.serviceName}</Link> at <span className="font-mono">{usage.mountPath}</span></li>)}</ul></InlineNotice> : null}{error ? <InlineNotice tone="danger" className="mx-5">{error}</InlineNotice> : null}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy || !volume || mountedBy.length > 0} aria-busy={busy} onClick={(event) => volume && remove(volume, event)}>{busy ? 'Deleting…' : 'Delete volume'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      })()}
      <Dialog open={open} onOpenChange={(next) => { if (!busy) { setOpen(next); if (next) setError(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit volume' : 'Create volume'}</DialogTitle></DialogHeader>
          <form onSubmit={save}>
            <DialogBody><div className="space-y-4">
              {error && <InlineNotice tone="danger">{error}</InlineNotice>}
              <div className="space-y-2"><Label htmlFor="volume-name">Name</Label><Input id="volume-name" name="name" defaultValue={editing?.name} readOnly={Boolean(editing)} required mono /></div>
              <div className="space-y-2"><Label htmlFor="volume-path">Storage path</Label><Input id="volume-path" name="hostPath" defaultValue={editing?.hostPath} required mono aria-describedby="volume-path-help" /><p id="volume-path-help" className="text-xs text-ink-muted">Use <span className="font-mono">@/name</span> for local storage. {allowAbsoluteHostPaths ? 'You can also use an absolute host path.' : 'Host paths aren’t allowed on this instance.'}</p></div>
            </div></DialogBody>
            <DialogFooter><Button type="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : editing ? 'Save volume' : 'Create volume'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
