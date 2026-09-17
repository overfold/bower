'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { updateEnvironmentAction } from '@/lib/actions/operations'
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

export function EnvironmentSettingsDialog({
  projectId,
  environment,
}: {
  projectId: string
  environment: {
    id: string
    promotionOrder: number
    envVarNames: string[]
  }
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
      await updateEnvironmentAction(projectId, environment.id, new FormData(event.currentTarget))
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update environment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm"><Pencil className="h-3.5 w-3.5" />Edit environment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit environment</DialogTitle></DialogHeader>
        <form onSubmit={submit}>
          <DialogBody>
            <div className="space-y-4">
              {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
              <input
                type="hidden"
                name="envVars"
                value={environment.envVarNames.map((name) => `${name}=`).join('\n')}
              />
              <div className="space-y-2">
                <Label htmlFor="promotionOrder">Promotion order</Label>
                <Input id="promotionOrder" name="promotionOrder" type="number" min={0} defaultValue={environment.promotionOrder} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save environment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
