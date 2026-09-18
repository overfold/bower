'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOrganizationAction } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { InlineNotice } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'

export function CreateOrganizationDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setOpen(false)
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setLoading(true)
    setError(null)

    const result = await createOrganizationAction(new FormData(form))
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      form.reset()
      handleClose()
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          New organization
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="instance-org-name">Name</Label>
                <Input id="instance-org-name" name="name" placeholder="Acme" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instance-org-slug">Slug</Label>
                <Input id="instance-org-slug" name="slug" placeholder="acme" className="font-mono text-[12.5px]" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instance-trellis-url">Trellis API URL</Label>
              <Input id="instance-trellis-url" name="trellisApiUrl" type="url" placeholder="https://trellis.example.com" className="font-mono text-[12.5px]" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instance-trellis-token">Trellis API token</Label>
              <Input id="instance-trellis-token" name="trellisApiToken" type="password" autoComplete="off" required mono />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" size="sm" onClick={handleClose} disabled={loading}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              {loading ? 'Creating…' : 'Create organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
