'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { updateOrganizationAction } from '@/lib/actions/settings'

interface OrgSettingsFormProps {
  org: {
    id: string
    name: string
    slug: string
  }
}

export function OrgSettingsForm({ org }: OrgSettingsFormProps) {
  const router = useRouter()
  const { toast } = useFeedback()
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    try {
      const result = await updateOrganizationAction(formData)
      if (result?.error) setError(result.error)
      else if (result?.success) {
        toast({ tone: 'success', title: 'Organization settings saved.' })
        setDirty(false)
        router.refresh()
      } else setError('Organization settings could not be saved. Please try again.')
    } catch {
      setError('Organization settings could not be saved. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-3xl">
      <form onSubmit={handleSubmit} onInput={() => setDirty(true)}>
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <div className="space-y-2">
            <Label htmlFor="name">Organization name</Label>
            <Input id="name" name="name" defaultValue={org.name} required />
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="primary" type="submit" disabled={loading || !dirty} aria-busy={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
