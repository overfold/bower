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
            Add a new environment to this project.
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

              <Button variant="primary" type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating…' : 'Create environment'}
              </Button>
            </div>
          </DialogBody>
        </form>
      </DialogContent>
    </Dialog>
  )
}
