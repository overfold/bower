'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { updateServiceVolumeMountsAction } from '@/lib/actions/service-settings'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mount = { name: string; container_path: string; read_only?: boolean }

export function VolumeMountEditor({ serviceId, environmentId, mounts: initial, volumes }: {
  serviceId: string
  environmentId: string | null
  mounts: Mount[]
  volumes: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mounts, setMounts] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function save() {
    const data = new FormData()
    data.set('volumes', JSON.stringify(mounts))
    startTransition(async () => {
      try {
        await updateServiceVolumeMountsAction(serviceId, environmentId, data)
        setOpen(false)
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not update mounts.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Edit mounts</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Volume mounts</DialogTitle></DialogHeader>
        <DialogBody><div className="space-y-4">
          {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
          {mounts.map((mount, index) => (
            <div key={`${mount.name}-${index}`} className="grid items-end gap-3 rounded-lg border border-line bg-sunken p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <div className="space-y-2"><Label>Project volume</Label><select value={mount.name} onChange={(event) => setMounts((all) => all.map((item, at) => at === index ? { ...item, name: event.target.value } : item))} className="flex h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px]">{volumes.map((name) => <option key={name}>{name}</option>)}</select></div>
              <div className="space-y-2"><Label>Mount path</Label><Input value={mount.container_path} onChange={(event) => setMounts((all) => all.map((item, at) => at === index ? { ...item, container_path: event.target.value } : item))} mono /></div>
              <label className="flex h-9 items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(mount.read_only)} onChange={(event) => setMounts((all) => all.map((item, at) => at === index ? { ...item, read_only: event.target.checked } : item))} />Read-only</label>
              <Button type="button" size="icon" variant="ghost" onClick={() => setMounts((all) => all.filter((_, at) => at !== index))}><Trash2 /></Button>
            </div>
          ))}
          <Button type="button" size="sm" disabled={!volumes.length || mounts.length >= volumes.length} onClick={() => { const name = volumes.find((candidate) => !mounts.some((mount) => mount.name === candidate)); if (name) setMounts((all) => [...all, { name, container_path: '/data' }]) }}><Plus />Attach volume</Button>
        </div></DialogBody>
        <DialogFooter><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save mounts'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
