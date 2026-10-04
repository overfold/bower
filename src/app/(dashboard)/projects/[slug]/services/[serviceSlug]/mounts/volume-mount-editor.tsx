'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { updateServiceVolumeMountsAction } from '@/lib/actions/service-settings'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineNotice } from '@/components/ui/feedback'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RowActions, RowActionItem, RowActionSeparator } from '@/components/ui/row-actions'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

type Mount = { name: string; container_path: string; read_only?: boolean }

export function VolumeMountEditor({ serviceId, environmentId, mounts: initial, volumes }: {
  serviceId: string
  environmentId: string | null
  mounts: Mount[]
  volumes: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const available = volumes.filter((name) => !initial.some((mount) => mount.name === name))
  const [name, setName] = useState(available[0] ?? '')
  const [path, setPath] = useState('/data')
  const [readOnly, setReadOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()
  function save() {
    const data = new FormData()
    data.set('volumes', JSON.stringify([...initial, { name, container_path: path, read_only: readOnly }]))
    startTransition(async () => {
      try {
        await updateServiceVolumeMountsAction(serviceId, environmentId, data)
        setOpen(false)
        router.refresh()
      } catch (cause) {
        setError(actionErrorMessage(cause, 'Could not update mounts.'))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (busy) return
      setOpen(next)
      if (next) {
        setError(null)
        setName(available[0] ?? '')
        setPath('/data')
        setReadOnly(false)
      }
    }}>
      <DialogTrigger asChild><Button variant="primary" size="sm" disabled={available.length === 0} title={available.length === 0 ? 'No unattached project volumes are available' : undefined}><Plus />Attach volume</Button></DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Attach volume</DialogTitle></DialogHeader>
        <DialogBody><div className="space-y-4">
          {error && <InlineNotice tone="danger">{error}</InlineNotice>}
          <div className="space-y-2"><Label htmlFor="mount-volume">Project volume</Label><Select value={name} onValueChange={setName}><SelectTrigger id="mount-volume"><SelectValue /></SelectTrigger><SelectContent>{available.map((volume) => <SelectItem key={volume} value={volume}>{volume}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="mount-path">Mount path</Label><Input id="mount-path" value={path} onChange={(event) => setPath(event.target.value)} mono required /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} />Read-only</label>
        </div></DialogBody>
        <DialogFooter><Button type="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button type="button" variant="primary" disabled={busy || !name || !path} aria-busy={busy} onClick={save}>{busy ? 'Attaching…' : 'Attach volume'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function VolumeMountActions({ serviceId, environmentId, mount, mounts }: { serviceId: string; environmentId: string; mount: Mount; mounts: Mount[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  function detach(event: React.MouseEvent) {
    event.preventDefault()
    setError(null)
    const data = new FormData()
    data.set('volumes', JSON.stringify(mounts.filter((item) => item.name !== mount.name)))
    startTransition(async () => {
      try { await updateServiceVolumeMountsAction(serviceId, environmentId, data); setOpen(false); router.refresh() }
      catch (cause) { setError(actionErrorMessage(cause, 'Could not detach volume.')) }
    })
  }
  return <AlertDialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next) }}><RowActions name={mount.name}><RowActionSeparator /><AlertDialogTrigger asChild><RowActionItem className="text-danger-600 focus:text-danger-600">Detach</RowActionItem></AlertDialogTrigger></RowActions><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Detach {mount.name}?</AlertDialogTitle><AlertDialogDescription>The volume will no longer be mounted at <span className="font-mono text-ink">{mount.container_path}</span>. Its stored data will not be deleted.</AlertDialogDescription></AlertDialogHeader>{error ? <InlineNotice tone="danger" className="mx-5">{error}</InlineNotice> : null}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={detach}>{busy ? 'Detaching…' : 'Detach volume'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
}
