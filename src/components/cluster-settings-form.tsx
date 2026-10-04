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
    tokenConfigured: boolean
    workloadIdentity: boolean
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
        toast({ tone: 'success', title: 'Trellis settings saved' })
        const tokenInput = formRef.current?.elements.namedItem('trellisApiToken')
        if (tokenInput instanceof HTMLInputElement) tokenInput.value = ''
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
    <Card>
      <form ref={formRef} onSubmit={handleSubmit} onInput={() => setDirty(true)}>
        <CardHeader>
          <CardTitle>Trellis connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          <div className="max-w-[720px] space-y-2">
            <Label htmlFor="trellisApiUrl" optional>Trellis API URL</Label>
            <Input id="trellisApiUrl" name="trellisApiUrl" defaultValue={org.trellisApiUrl} className="font-mono" />
            <p className="text-xs text-ink-muted">The full URL of the Trellis API, for example <span className="font-mono">https://trellis.example.com</span>.</p>
          </div>
          <div className="max-w-[720px] space-y-2">
            <Label htmlFor="trellisApiToken" optional>Trellis API token</Label>
            <Input id="trellisApiToken" name="trellisApiToken" type="password" defaultValue="" autoComplete="new-password" mono />
            <p className="text-xs text-ink-muted">{org.workloadIdentity ? 'Workload identity is enabled.' : org.tokenConfigured ? 'An API token is configured.' : 'No API token is configured.'} Leave blank to keep the current credentials, or enter a replacement token.</p>
          </div>
        </CardContent>
      </form>
      <UnsavedChangesBar dirty={dirty} pending={loading} onDiscard={() => { formRef.current?.reset(); setDirty(false); setError(null) }} onSave={() => formRef.current?.requestSubmit()} />
    </Card>
  )
}
