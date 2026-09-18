'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trash2 } from 'lucide-react'
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
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()
  const suggestions = volumes.filter((name) =>
    !mounts.some((mount) => mount.name === name) && name.toLowerCase().includes(query.toLowerCase()),
  )

  function addMount(name: string) {
    setMounts((all) => [...all, { name, container_path: '/data' }])
    setQuery('')
  }

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
      <DialogTrigger asChild><Button size="sm">Attach volume</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Volume mounts</DialogTitle></DialogHeader>
        <DialogBody><div className="space-y-4">
          {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="volume-search">Find a project volume</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
              <Input id="volume-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search volumes…" className="pl-8" autoFocus />
            </div>
            {suggestions.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-line bg-surface">
                {suggestions.map((name) => (
                  <button key={name} type="button" onClick={() => addMount(name)} className="block w-full border-b border-line px-3 py-2.5 text-left font-mono text-[12.5px] text-ink transition-colors last:border-b-0 hover:bg-sunken">
                    {name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-muted">{mounts.length >= volumes.length ? 'All available volumes are attached.' : 'No volumes match your search.'}</p>
            )}
          </div>
          {mounts.map((mount, index) => (
            <div key={`${mount.name}-${index}`} className="grid items-end gap-3 rounded-lg border border-line bg-sunken p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <div className="space-y-2"><Label>Project volume</Label><div className="flex h-9 items-center rounded-lg border border-line bg-surface px-3 font-mono text-[12.5px] text-ink">{mount.name}</div></div>
              <div className="space-y-2"><Label>Mount path</Label><Input value={mount.container_path} onChange={(event) => setMounts((all) => all.map((item, at) => at === index ? { ...item, container_path: event.target.value } : item))} mono /></div>
              <label className="flex h-9 items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(mount.read_only)} onChange={(event) => setMounts((all) => all.map((item, at) => at === index ? { ...item, read_only: event.target.checked } : item))} />Read-only</label>
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${mount.name}`} onClick={() => setMounts((all) => all.filter((_, at) => at !== index))}><Trash2 /></Button>
            </div>
          ))}
        </div></DialogBody>
        <DialogFooter><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save mounts'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
