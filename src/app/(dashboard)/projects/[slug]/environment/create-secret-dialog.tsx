'use client'

import { useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { setSecretAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { InlineNotice } from '@/components/ui/feedback'

export function CreateSecretDialog({
  projectId,
  environmentId,
}: {
  projectId: string
  environmentId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    setError(null)
    try {
      await setSecretAction(projectId, formData)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not save secret.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) { setOpen(next); if (next) setError(null) } }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Add secret
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add secret</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit}>
          <DialogBody className="space-y-4">
            {error && <InlineNotice tone="error">{error}</InlineNotice>}
            <input type="hidden" name="environmentId" value={environmentId} />
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="MY_SECRET_KEY"
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                name="value"
                type="password"
                placeholder="Secret value"
                required
                mono
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save secret'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
