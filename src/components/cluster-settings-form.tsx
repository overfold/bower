'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { updateOrganizationAction } from '@/lib/actions/settings'

interface ClusterSettingsFormProps {
  org: {
    trellisApiUrl: string
    trellisApiToken: string
  }
}

export function ClusterSettingsForm({ org }: ClusterSettingsFormProps) {
  const router = useRouter()
  const { toast } = useFeedback()
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    try {
      const result = await updateOrganizationAction(formData)
      if (result?.error) setError(result.error)
      else if (result?.success) {
        toast({ tone: 'success', title: 'Trellis settings saved.' })
        setDirty(false)
        router.refresh()
      } else setError('Trellis settings could not be saved. Please try again.')
    } catch {
      setError('Trellis settings could not be saved. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-3xl">
      <form ref={formRef} onSubmit={handleSubmit} onInput={() => setDirty(true)}>
        <CardHeader>
          <CardTitle>Trellis connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <div className="space-y-2">
            <Label htmlFor="trellisApiUrl" optional>Trellis API URL</Label>
            <Input id="trellisApiUrl" name="trellisApiUrl" defaultValue={org.trellisApiUrl} placeholder="https://trellis.example.com" className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trellisApiToken" optional>Trellis API token</Label>
            <Input id="trellisApiToken" name="trellisApiToken" type="password" defaultValue={org.trellisApiToken} autoComplete="off" mono />
          </div>
        </CardContent>
      </form>
      <UnsavedChangesBar dirty={dirty} pending={loading} onDiscard={() => { formRef.current?.reset(); setDirty(false); setError(null) }} onSave={() => formRef.current?.requestSubmit()} />
    </Card>
  )
}
