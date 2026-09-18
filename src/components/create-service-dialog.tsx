'use client'

import { useState } from 'react'
import { createServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, ChevronDown } from 'lucide-react'

export function CreateServiceDialog({ projectSlug, environmentId }: { projectSlug: string; environmentId?: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await createServiceAction(projectSlug, formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New service
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create service</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {environmentId && <input type="hidden" name="environmentId" value={environmentId} />}
            {error && (
              <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="api-server" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Image</Label>
              <Input id="image" name="image" placeholder="nginx:latest" required mono />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="replicas">Replicas</Label>
                <Input id="replicas" name="replicas" type="number" defaultValue={1} min={1} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="strategy">Deployment strategy</Label>
                <div className="relative">
                  <select
                    id="strategy"
                    name="strategy"
                    defaultValue="recreate"
                    className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 pr-9 text-[13px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-enter focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="recreate">recreate</option>
                    <option value="rolling">rolling</option>
                    <option value="blue_green">blue_green</option>
                    <option value="canary">canary</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpu">CPU (millicores)</Label>
                <Input id="cpu" name="cpu" type="number" defaultValue={100} min={0} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memory">Memory (MB)</Label>
                <Input id="memory" name="memory" type="number" defaultValue={128} min={0} required />
              </div>
            </div>
            <Button variant="primary" type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create service'}
            </Button>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
