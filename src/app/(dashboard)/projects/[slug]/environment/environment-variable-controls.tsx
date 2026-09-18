'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { deleteEnvironmentVariableAction, setEnvironmentVariableAction } from '@/lib/actions/environment-variables'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CreateEnvironmentVariableDialog({
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
      await setEnvironmentVariableAction(projectId, environmentId, formData)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save environment variable.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Add variable
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add environment variable</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form action={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="environmentVariableName">Name</Label>
              <Input
                id="environmentVariableName"
                name="name"
                placeholder="DATABASE_URL"
                required
                autoCapitalize="characters"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="environmentVariableValue">Value</Label>
              <Input
                id="environmentVariableValue"
                name="value"
                type="password"
                placeholder="Value"
                required
                className="font-mono"
              />
              <p className="text-2xs leading-relaxed text-ink-muted">
                Values are stored securely and injected into every service in this project.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save variable'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteEnvironmentVariableButton({
  projectId,
  environmentId,
  name,
}: {
  projectId: string
  environmentId: string
  name: string
}) {
  return (
    <form action={deleteEnvironmentVariableAction.bind(null, projectId, environmentId, name)}>
      <Button variant="ghost" size="sm" type="submit" className="text-danger-500 hover:text-danger-500" aria-label={`Delete ${name}`}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </form>
  )
}
