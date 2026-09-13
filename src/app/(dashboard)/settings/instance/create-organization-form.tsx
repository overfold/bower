'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOrganizationAction } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { InlineNotice } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CreateOrganizationForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setLoading(true)
    setError(null)
    setSuccess(false)

    const result = await createOrganizationAction(new FormData(form))
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      form.reset()
      setSuccess(true)
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <div>
            <CardTitle>Create organization</CardTitle>
            <p className="mt-0.5 text-xs text-ink-muted">Connect a new organization to its Trellis cluster</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          {success ? <InlineNotice tone="brand">Organization created.</InlineNotice> : null}
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
            <Input id="instance-trellis-token" name="trellisApiToken" type="password" autoComplete="off" required />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {loading ? 'Creating…' : 'Create organization'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
