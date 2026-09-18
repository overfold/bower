'use client'

import { useState, useTransition } from 'react'
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

type Volume = { id: string; name: string; hostPath: string }

export function VolumeManager({ projectId, environmentId, volumes, canManage }: {
  projectId: string
  environmentId: string
  volumes: Volume[]
  canManage: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Volume | null>(null)
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
        setError(cause instanceof Error ? cause.message : 'Could not save volume.')
      }
    })
  }

  function remove(volume: Volume) {
    setError(null)
    startTransition(async () => {
      try {
        await deleteProjectVolumeAction(projectId, environmentId, volume.id)
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not delete volume.')
      }
    })
  }

  return (
    <Panel>
      <PanelHeader title="Volumes" hint={`${volumes.length} ${volumes.length === 1 ? 'volume' : 'volumes'}`} action={canManage ? <Button size="sm" variant="primary" onClick={() => edit()}><Plus />Add volume</Button> : undefined} />
      {error && <div className="mx-4 mt-4 rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
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
              <TableCell><div className="flex justify-end gap-1">{canManage && <><Button size="sm" variant="ghost" onClick={() => edit(volume)}>Edit</Button><IconButton label={`Delete ${volume.name}`} disabled={busy} onClick={() => remove(volume)}><Trash2 /></IconButton></>}</div></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit volume' : 'Add volume'}</DialogTitle></DialogHeader>
          <form onSubmit={save}>
            <DialogBody><div className="space-y-4">
              {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
              <div className="space-y-2"><Label htmlFor="volume-name">Name</Label><Input id="volume-name" name="name" defaultValue={editing?.name} readOnly={Boolean(editing)} required mono /></div>
              <div className="space-y-2"><Label htmlFor="volume-path">Backing path</Label><Input id="volume-path" name="hostPath" defaultValue={editing?.hostPath ?? '@/data'} required mono /><p className="text-xs text-ink-muted">Use <span className="font-mono">@/name</span> for Trellis-managed local storage or an existing absolute host directory.</p></div>
            </div></DialogBody>
            <DialogFooter><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save volume'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
