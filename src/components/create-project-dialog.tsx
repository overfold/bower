'use client'

import { useEffect, useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { unstable_rethrow, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createProjectAction } from '@/lib/actions/projects'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogBody, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { InlineNotice } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus } from 'lucide-react'

let projectActionClaimed = false

export function CreateProjectDialog() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [requestedName, setRequestedName] = useState('')

  useEffect(() => {
    if (searchParams.get('action') !== 'new') {
      projectActionClaimed = false
      return
    }
    if (projectActionClaimed) return
    projectActionClaimed = true
    const name = searchParams.get('name') ?? ''
    queueMicrotask(() => {
      setRequestedName(name)
      setOpen(true)
    })
    const next = new URLSearchParams(searchParams.toString())
    next.delete('action')
    next.delete('name')
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await createProjectAction(formData)
      if (result?.error) setError(result.error)
    } catch (err) {
      unstable_rethrow(err)
      setError(actionErrorMessage(err, 'Could not create the project.'))
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
          <Plus />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} aria-busy={loading}>
          <DialogBody className="space-y-4">
            {error && <InlineNotice tone="error">{error}</InlineNotice>}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input key={requestedName} id="name" name="name" placeholder="my-project" defaultValue={requestedName} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" placeholder="Optional description" rows={3} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" size="sm" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button variant="primary" type="submit" size="sm" disabled={loading} aria-busy={loading}>
              {loading ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
