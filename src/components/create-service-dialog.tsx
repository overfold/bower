'use client'

import { useRef, useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { unstable_rethrow } from 'next/navigation'
import { createServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogBody, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { InlineNotice } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import type { TrellisJobLimits } from '@/types/trellis'
import { formatCpu, formatMemory } from '@/lib/format'

export function CreateServiceDialog({ projectSlug, limits }: { projectSlug: string; limits?: TrellisJobLimits }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [image, setImage] = useState('')
  const [strategy, setStrategy] = useState('rolling')
  const imageRef = useRef<HTMLInputElement>(null)
  const imageValid = /^[\w.-]+(?::\d+)?(?:\/[\w.-]+)*(?:[:@][\w][\w.:-]*)?$/.test(image)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!imageValid) {
      setError('Enter a valid container image reference.')
      imageRef.current?.focus()
      return
    }
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('cpu', String(Number(formData.get('cpu')) * 1000))
      const result = await createServiceAction(projectSlug, formData)
      if (result?.error) setError(result.error)
    } catch (err) {
      unstable_rethrow(err)
      setError(actionErrorMessage(err, 'Could not create the service.'))
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (loading) return
    if (nextOpen) {
      setError(null)
      setLoading(false)
    }
    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus />
          New service
        </Button>
      </DialogTrigger>
      <DialogContent size="md" onOpenAutoFocus={(event) => { event.preventDefault(); document.getElementById('name')?.focus() }}>
        <DialogHeader>
          <DialogTitle>Create service</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} aria-busy={loading}>
          <DialogBody className="space-y-4">
            {error && <InlineNotice tone="error">{error}</InlineNotice>}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Image</Label>
              <Input ref={imageRef} id="image" name="image" value={image} onChange={(event) => setImage(event.target.value)} required mono aria-invalid={image.length > 0 && !imageValid} />
              <p className={`text-xs ${image.length > 0 && !imageValid ? 'text-danger-500' : 'text-ink-muted'}`}>Use a registry/repository image reference with a tag or digest.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="replicas">Replicas</Label>
                <Input id="replicas" name="replicas" type="number" defaultValue={1} min={1} max={limits?.max_replicas_per_task_group} required />
                {limits ? <p className="text-xs text-ink-muted">Up to {limits.max_replicas_per_task_group} replicas</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="strategy">Deployment strategy</Label>
                <Select name="strategy" value={strategy} onValueChange={setStrategy} required>
                  <SelectTrigger id="strategy"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rolling">Rolling</SelectItem>
                    <SelectItem value="recreate">Recreate</SelectItem>
                    <SelectItem value="blue_green">Blue/green</SelectItem>
                    <SelectItem value="canary">Canary</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-ink-muted">{{ rolling: 'Replaces replicas one at a time. No downtime.', recreate: 'Stops existing replicas before starting replacements.', blue_green: 'Starts a complete replacement before switching traffic.', canary: 'Moves traffic to the new release in gradual steps.' }[strategy]}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpu">CPU</Label>
                <div className="relative"><Input id="cpu" name="cpu" type="number" defaultValue={0.1} min={0.001} step={0.001} className="pr-14" required /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-ink-muted">cores</span></div>
                {limits ? <p className="text-xs text-ink-muted">Up to {formatCpu(limits.max_task_cpu)} per replica</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="memory">Memory</Label>
                <div className="relative"><Input id="memory" name="memory" type="number" defaultValue={128} min={1} step={1} className="pr-10" required /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-ink-muted">MB</span></div>
                {limits ? <p className="text-xs text-ink-muted">Up to {formatMemory(limits.max_task_memory)} per replica</p> : null}
              </div>
            </div>
            <p className="text-xs text-ink-muted">The service is created without deploying. Review its configuration, then deploy when ready.</p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" size="sm" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button variant="primary" type="submit" size="sm" disabled={loading} loading={loading}>
              {loading ? 'Creating…' : 'Create service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
