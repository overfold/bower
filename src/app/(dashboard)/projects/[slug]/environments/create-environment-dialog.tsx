'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createEnvironmentAction } from '@/lib/actions/operations'

export function CreateEnvironmentDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      await createEnvironmentAction(projectId, formData)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create environment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New environment
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create environment</DialogTitle>
          <DialogDescription>
            Add a deployment and isolation boundary to this project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody>
            <div className="space-y-4">
              {error && (
                <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Environment name</Label>
                <Input id="name" name="name" required placeholder="e.g. staging" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="envVars">Shared environment variables</Label>
                <textarea
                  id="envVars"
                  name="envVars"
                  placeholder="KEY=value, one per line"
                  className="flex min-h-[80px] w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[12.5px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-enter placeholder:text-ink-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <p className="text-2xs leading-relaxed text-ink-muted">
                  Shared values are stored as Trellis secrets and injected into services deployed to this environment.
                </p>
              </div>

              <Button variant="primary" type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Create environment'}
              </Button>
            </div>
          </DialogBody>
        </form>
      </DialogContent>
    </Dialog>
  )
}
