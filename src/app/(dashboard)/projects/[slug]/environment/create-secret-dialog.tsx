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
import { Eye, EyeOff, Plus, Upload } from 'lucide-react'
import { InlineNotice } from '@/components/ui/feedback'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

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
  const [visible, setVisible] = useState(false)
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    setError(null)
    try {
      await setSecretAction(projectId, formData)
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not save secret.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) { setOpen(next); if (next) { setError(null); setSaved(false) } } }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Add secret
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add secret</DialogTitle>
        </DialogHeader>
        {saved ? <><DialogBody><InlineNotice tone="success">Secret saved. Bind it to a service to make it available to a workload.</InlineNotice></DialogBody><DialogFooter><Button type="button" onClick={() => setOpen(false)}>Done</Button><Button asChild variant="primary"><Link href="#service-bindings" onClick={() => setOpen(false)}>Bind to a service</Link></Button></DialogFooter></> :
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
              <Textarea
                id="value"
                name="value"
                placeholder="Secret value"
                required
                mono
                rows={6}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className={visible ? '' : 'text-transparent caret-ink [text-shadow:0_0_7px_var(--color-ink)]'}
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => setVisible((shown) => !shown)}>{visible ? <EyeOff /> : <Eye />}{visible ? 'Hide' : 'Show'}</Button>
                <Button asChild type="button" size="sm"><label><Upload />Upload file<input className="sr-only" type="file" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setValue(await file.text()) }} /></label></Button>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save secret'}</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  )
}
