'use client'

import { useState, useTransition } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { HardDrive, Plus, Trash2 } from 'lucide-react'
import { deleteProjectVolumeAction, upsertProjectVolumeAction } from '@/lib/actions/project-volumes'
import { Button, IconButton } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InlineNotice } from '@/components/ui/feedback'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type Volume = { id: string; name: string; hostPath: string }

export function VolumeManager({ projectId, environmentId, volumes, canManage, allowAbsoluteHostPaths }: {
  projectId: string
  environmentId: string
  volumes: Volume[]
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
      <PanelHeader title="Volumes" hint={`${volumes.length} ${volumes.length === 1 ? 'volume' : 'volumes'}`} action={canManage ? <Button size="sm" variant="primary" onClick={() => edit()}><Plus />Add volume</Button> : undefined} />
      {volumes.length === 0 ? (
        <EmptyState icon={<HardDrive className="h-4 w-4" />} title="No volumes" body="Create a namespace-scoped volume, then attach it from a service’s Mounts tab." />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Backing path</TableHead><TableHead>Storage</TableHead><TableHead className="w-24 text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{volumes.map((volume) => (
            <TableRow key={volume.id}>
              <TableCell className="font-mono text-xs font-medium">{volume.name}</TableCell>
              <TableCell className="font-mono text-xs text-ink-muted">{volume.hostPath}</TableCell>
              <TableCell className="text-ink-muted">{volume.hostPath.startsWith('@/') ? 'Managed local' : 'Host path'}</TableCell>
              <TableCell><div className="flex justify-end gap-1">{canManage && <><Button size="sm" variant="ghost" onClick={() => edit(volume)}>Edit</Button><AlertDialog open={deletingId === volume.id} onOpenChange={(next) => { if (!busy) { setDeletingId(next ? volume.id : null); if (next) setError(null) } }}><AlertDialogTrigger asChild><IconButton label={`Delete ${volume.name}`} disabled={busy}><Trash2 /></IconButton></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {volume.name}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the volume definition for <span className="font-mono text-ink">{volume.hostPath}</span>. Services must stop using it before it can be deleted.</AlertDialogDescription></AlertDialogHeader>{error ? <InlineNotice tone="error" className="mx-5">{error}</InlineNotice> : null}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} aria-busy={busy} onClick={(event) => remove(volume, event)}>{busy ? 'Deleting…' : 'Delete volume'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>}</div></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
      <Dialog open={open} onOpenChange={(next) => { if (!busy) { setOpen(next); if (next) setError(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit volume' : 'Add volume'}</DialogTitle></DialogHeader>
          <form onSubmit={save}>
            <DialogBody><div className="space-y-4">
              {error && <InlineNotice tone="error">{error}</InlineNotice>}
              <div className="space-y-2"><Label htmlFor="volume-name">Name</Label><Input id="volume-name" name="name" defaultValue={editing?.name} readOnly={Boolean(editing)} required mono /></div>
              <div className="space-y-2"><Label htmlFor="volume-path">Backing path</Label><Input id="volume-path" name="hostPath" defaultValue={editing?.hostPath ?? '@/data'} required mono aria-describedby="volume-path-help" /><p id="volume-path-help" className="text-xs text-ink-muted">{allowAbsoluteHostPaths ? <>Use <span className="font-mono">@/name</span> for Trellis-managed local storage or an operator-approved absolute host directory.</> : <>Use a Trellis-managed local path below <span className="font-mono">@/</span>. Absolute host paths are disabled by operator policy.</>}</p></div>
            </div></DialogBody>
            <DialogFooter><Button type="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : 'Save volume'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
