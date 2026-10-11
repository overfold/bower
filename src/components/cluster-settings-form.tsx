'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  const [savedUrl, setSavedUrl] = useState(org.trellisApiUrl)
  const [url, setUrl] = useState(org.trellisApiUrl)
  const [token, setToken] = useState('')
  const dirty = url !== savedUrl || token !== ''
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
        setToken('')
        setSavedUrl(url)
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
      <form ref={formRef} onSubmit={handleSubmit}>
        <CardHeader title="Trellis connection" hint="The endpoint and credentials Bower uses to reach Trellis." />
        <CardContent className="space-y-6">
          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          <div className="max-w-[720px] space-y-2">
            <Label htmlFor="trellisApiUrl" optional>Trellis API URL</Label>
            <Input id="trellisApiUrl" name="trellisApiUrl" value={url} onChange={(event) => setUrl(event.target.value)} dirty={url !== savedUrl} className="font-mono" />
            <p className="text-xs text-ink-muted">The full URL of the Trellis API, for example <span className="font-mono">https://trellis.example.com</span>.</p>
          </div>
          <div className="max-w-[720px] space-y-2">
            <Label htmlFor="trellisApiToken" optional>Trellis API token</Label>
            <Input id="trellisApiToken" name="trellisApiToken" type="password" value={token} onChange={(event) => setToken(event.target.value)} dirty={token !== ''} autoComplete="new-password" mono />
            <p className="text-xs text-ink-muted">{org.workloadIdentity ? 'Workload identity is enabled.' : org.tokenConfigured ? 'An API token is configured.' : 'No API token is configured.'} Leave blank to keep the current credentials, or enter a replacement token.</p>
          </div>
        </CardContent>
      </form>
      <UnsavedChangesBar dirty={dirty} pending={loading} onDiscard={() => { setUrl(savedUrl); setToken(''); setError(null) }} onSave={() => formRef.current?.requestSubmit()} />
    </Card>
  )
}
