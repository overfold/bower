'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { updateAccountAction } from '@/lib/actions/settings'

interface AccountSettingsFormProps {
  user: {
    name: string
    email: string
    avatarUrl: string | null
  }
}

export function AccountSettingsForm({ user }: AccountSettingsFormProps) {
  const router = useRouter()
  const { toast } = useFeedback()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    try {
      const result = await updateAccountAction(formData)
      if (result?.error) setError(result.error)
      else if (result?.success) {
        toast({ tone: 'success', title: 'Account updated.' })
        router.refresh()
      } else setError('Account settings could not be saved. Please try again.')
    } catch {
      setError('Account settings could not be saved. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={user.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={user.email} disabled className="bg-sunken" aria-describedby="email-help" />
            <p id="email-help" className="text-xs text-ink-muted">Email cannot be changed.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatarUrl">Avatar URL</Label>
            <Input id="avatarUrl" name="avatarUrl" defaultValue={user.avatarUrl ?? ''} placeholder="https://example.com/avatar.png" mono />
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="primary" type="submit" disabled={loading} aria-busy={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
