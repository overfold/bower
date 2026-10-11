'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  const [savedName, setSavedName] = useState(org.name)
  const [name, setName] = useState(org.name)
  const dirty = name !== savedName
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
        toast({ tone: 'success', title: 'Organization settings saved' })
        setSavedName(name)
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
      <form ref={formRef} onSubmit={handleSubmit}>
        <CardHeader title="Organization details" hint="The name and identity of your organization." />
        <CardContent className="space-y-6">
          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          <div className="max-w-xl space-y-2">
            <Label htmlFor="name">Organization name</Label>
            <Input id="name" name="name" value={name} onChange={(event) => setName(event.target.value)} dirty={dirty} required />
          </div>
          <div className="max-w-xl space-y-2"><Label htmlFor="organization-slug">Slug</Label><Input id="organization-slug" name="slug" value={org.slug} readOnly mono className="bg-sunken" aria-describedby="organization-slug-help" /><p id="organization-slug-help" className="text-xs text-ink-muted">Set when the organization was created.</p></div>
        </CardContent>
      </form>
      <UnsavedChangesBar dirty={dirty} pending={loading} onDiscard={() => { setName(savedName); setError(null) }} onSave={() => formRef.current?.requestSubmit()} />
    </Card>
  )
}
