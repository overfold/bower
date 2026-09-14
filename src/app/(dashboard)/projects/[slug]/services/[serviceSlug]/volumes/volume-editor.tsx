'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { updateServiceVolumesAction } from '@/lib/actions/service-settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TrellisVolume } from '@/types/trellis'

type EditableVolume = TrellisVolume & { storage: 'managed' | 'host' }

function normalizeVolumes(value: unknown): EditableVolume[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name : ''
    const containerPath = typeof row.container_path === 'string'
      ? row.container_path
      : typeof row.path === 'string'
        ? row.path
        : ''
    let hostPath = typeof row.host_path === 'string' ? row.host_path : ''
    if (!hostPath && typeof row.host_volume === 'string' && row.host_volume) {
      const legacy = row.host_volume
      hostPath = legacy.startsWith('/') || legacy.startsWith('@/') ? legacy : `@/${legacy}`
    }
    if (!hostPath && name) hostPath = `@/${name}`
    if (!name || !containerPath) return []
    return [{
      name,
      host_path: hostPath,
      container_path: containerPath,
      read_only: row.read_only === true,
      storage: hostPath.startsWith('@/') ? 'managed' : 'host',
    }]
  })
}

export function VolumeEditor({
  serviceId,
  environmentId,
  volumes: initialVolumes,
}: {
  serviceId: string
  environmentId: string
  volumes: unknown
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [volumes, setVolumes] = useState<EditableVolume[]>(() => normalizeVolumes(initialVolumes))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateVolume(index: number, patch: Partial<EditableVolume>) {
    setVolumes((current) => current.map((volume, at) => at === index ? { ...volume, ...patch } : volume))
  }

  function changeStorage(index: number, storage: 'managed' | 'host') {
    const current = volumes[index]
    const safeName = current.name || 'data'
    updateVolume(index, {
      storage,
      host_path: storage === 'managed'
        ? (current.host_path.startsWith('@/') ? current.host_path : `@/${safeName}`)
        : (current.host_path.startsWith('/') && !current.host_path.startsWith('@/') ? current.host_path : `/srv/${safeName}`),
    })
  }

  function addVolume() {
    const suffix = volumes.length + 1
    const name = suffix === 1 ? 'data' : `data-${suffix}`
    setVolumes((current) => [...current, {
      name,
      host_path: `@/${name}`,
      container_path: '/data',
      read_only: false,
      storage: 'managed',
    }])
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('volumes', JSON.stringify(volumes.map(({ storage: _storage, ...volume }) => volume)))
      await updateServiceVolumesAction(serviceId, environmentId, formData)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update volumes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">Edit volumes</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Volumes</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Managed local paths use <span className="font-mono text-ink-soft">@/</span> and are created under Trellis&apos;s namespaced volume root. Host paths use an absolute node path that must already exist.
            </p>
            {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
            {volumes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-sunken px-4 py-8 text-center text-[13px] text-ink-muted">
                This environment has no volumes attached.
              </div>
            ) : (
              <div className="space-y-3">
                {volumes.map((volume, index) => (
                  <div key={index} className="rounded-xl border border-line bg-sunken p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Volume {index + 1}</span>
                      <Button variant="ghost" size="sm" type="button" onClick={() => setVolumes((current) => current.filter((_, at) => at !== index))} className="text-danger-500 hover:text-danger-500">
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`volume-name-${index}`}>Name</Label>
                        <Input id={`volume-name-${index}`} value={volume.name} onChange={(event) => updateVolume(index, { name: event.target.value })} mono />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`volume-storage-${index}`}>Storage</Label>
                        <select
                          id={`volume-storage-${index}`}
                          value={volume.storage}
                          onChange={(event) => changeStorage(index, event.target.value as 'managed' | 'host')}
                          className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 text-[13px] text-ink shadow-card focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        >
                          <option value="managed">Managed local</option>
                          <option value="host">Host path</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`volume-host-${index}`}>{volume.storage === 'managed' ? 'Managed backing path' : 'Host path'}</Label>
                        <Input id={`volume-host-${index}`} value={volume.host_path} onChange={(event) => updateVolume(index, { host_path: event.target.value })} mono />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`volume-container-${index}`}>Mount path</Label>
                        <Input id={`volume-container-${index}`} value={volume.container_path} onChange={(event) => updateVolume(index, { container_path: event.target.value })} mono />
                      </div>
                    </div>
                    <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
                      <input
                        type="checkbox"
                        checked={Boolean(volume.read_only)}
                        onChange={(event) => updateVolume(index, { read_only: event.target.checked })}
                        className="h-4 w-4 rounded border-line-strong accent-brand-500"
                      />
                      Mount read-only
                    </label>
                  </div>
                ))}
              </div>
            )}
            <Button variant="default" size="sm" type="button" onClick={addVolume}>
              <Plus className="h-3.5 w-3.5" />
              Add volume
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="default" type="button" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save volumes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
