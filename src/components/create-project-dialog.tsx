'use client'

import { useState } from 'react'
import { createProjectAction } from '@/lib/actions/projects'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'

export function CreateProjectDialog({ teams }: { teams?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await createProjectAction(formData)
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
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="my-project" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" placeholder="Optional description" rows={3} />
            </div>
            {teams && teams.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="owningTeamId">Owning team <span className="font-normal text-ink-muted">(optional)</span></Label>
                <Select name="owningTeamId">
                  <SelectTrigger id="owningTeamId"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="registryUrl">Registry URL</Label>
              <Input id="registryUrl" name="registryUrl" placeholder="registry.example.com" />
            </div>
            <Button variant="primary" type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create project'}
            </Button>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
