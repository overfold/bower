'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar'
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
    <Card>
      <form ref={formRef} onSubmit={handleSubmit} onInput={() => setDirty(true)}>
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <div className="max-w-xl space-y-2">
            <Label htmlFor="name">Organization name</Label>
            <Input id="name" name="name" defaultValue={org.name} required />
          </div>
          <div className="max-w-xl space-y-2"><Label htmlFor="organization-slug">Slug</Label><Input id="organization-slug" name="slug" value={org.slug} readOnly mono className="bg-sunken" aria-describedby="organization-slug-help" /><p id="organization-slug-help" className="text-xs text-ink-muted">Set when the organization was created.</p></div>
        </CardContent>
      </form>
      <UnsavedChangesBar dirty={dirty} pending={loading} onDiscard={() => { formRef.current?.reset(); setDirty(false); setError(null) }} onSave={() => formRef.current?.requestSubmit()} />
    </Card>
  )
}
