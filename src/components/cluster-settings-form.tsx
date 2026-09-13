'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineNotice } from '@/components/ui/empty-state'
import { updateOrganizationAction } from '@/lib/actions/settings'

interface ClusterSettingsFormProps {
  org: {
    trellisApiUrl: string
    trellisApiToken: string
  }
}

export function ClusterSettingsForm({ org }: ClusterSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)
    const result = await updateOrganizationAction(formData)
    if (result?.error) setError(result.error)
    else if (result?.success) {
      setSuccess(true)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Trellis connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          {success ? <InlineNotice tone="brand">Settings updated.</InlineNotice> : null}
          <div className="space-y-2">
            <Label htmlFor="trellisApiUrl">Trellis API URL</Label>
            <Input id="trellisApiUrl" name="trellisApiUrl" defaultValue={org.trellisApiUrl} placeholder="https://trellis.example.com" className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trellisApiToken">Trellis API token</Label>
            <Input id="trellisApiToken" name="trellisApiToken" type="password" defaultValue={org.trellisApiToken} autoComplete="off" />
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="primary" type="submit" size="sm" disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
