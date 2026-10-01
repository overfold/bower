'use client'

import { useState } from 'react'
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

export function CreateServiceDialog({ projectSlug }: { projectSlug: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
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
          <Plus className="mr-1.5 h-4 w-4" />
          New service
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create service</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} aria-busy={loading}>
          <DialogBody className="space-y-4">
            {error && <InlineNotice tone="error">{error}</InlineNotice>}
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
                <Select name="strategy" defaultValue="recreate" required>
                  <SelectTrigger id="strategy"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recreate">Recreate</SelectItem>
                    <SelectItem value="rolling">Rolling</SelectItem>
                    <SelectItem value="blue_green">Blue/green</SelectItem>
                    <SelectItem value="canary">Canary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpu">CPU (millicores)</Label>
                <Input id="cpu" name="cpu" type="number" defaultValue={100} min={1} step={1} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memory">Memory (MB)</Label>
                <Input id="memory" name="memory" type="number" defaultValue={128} min={1 / 1048576} step="any" required />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" size="sm" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button variant="primary" type="submit" size="sm" disabled={loading} aria-busy={loading}>
              {loading ? 'Creating…' : 'Create service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
