'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setSecretAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus } from 'lucide-react'

export function CreateSecretDialog({
  projectId,
  environments,
}: {
  projectId: string
  environments: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fixedEnvironment = environments.length === 1 ? environments[0] : null

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    setError(null)
    try {
      await setSecretAction(projectId, formData)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save secret.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <DialogBody>
          <form action={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">
                {error}
              </div>
            )}
            {fixedEnvironment ? (
              <div className="space-y-2">
                <Label>Environment</Label>
                <input type="hidden" name="environmentId" value={fixedEnvironment.id} />
                <div className="flex h-9 items-center rounded-lg border border-line bg-sunken px-3 text-[13px] text-ink-soft">
                  {fixedEnvironment.name}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="environmentId">Environment</Label>
                <Select name="environmentId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.map((env) => (
                      <SelectItem key={env.id} value={env.id}>
                        {env.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sharedName">Shared group (optional)</Label>
              <Input
                id="sharedName"
                name="sharedName"
                placeholder="e.g. database-credentials"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save secret'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
