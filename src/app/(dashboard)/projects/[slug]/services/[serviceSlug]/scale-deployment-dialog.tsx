'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gauge } from 'lucide-react'
import { scaleServiceAction } from '@/lib/actions/services'
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

export function ScaleDeploymentDialog({
  serviceId,
  environmentId,
  environmentName,
  replicas,
  disabled,
}: {
  serviceId: string
  environmentId: string
  environmentName: string
  replicas: number
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const next = Number(new FormData(event.currentTarget).get('replicas'))
      await scaleServiceAction(serviceId, environmentId, next)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not scale deployment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <Gauge className="h-3.5 w-3.5" />
          Scale
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Scale {environmentName}</DialogTitle></DialogHeader>
        <form onSubmit={submit}>
          <DialogBody>
            <div className="space-y-4">
              {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
              <div className="space-y-2">
                <Label htmlFor={`replicas-${environmentId}`}>Desired replicas</Label>
                <Input id={`replicas-${environmentId}`} name="replicas" type="number" min={0} defaultValue={replicas} required />
                <p className="text-2xs leading-relaxed text-ink-muted">
                  Replica count belongs to this environment deployment. Changing it does not change the service definition or any other environment.
                </p>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Scaling…' : 'Scale deployment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
