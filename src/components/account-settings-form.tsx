'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar'
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
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

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
        setDirty(false)
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
      <form ref={formRef} onSubmit={handleSubmit} onInput={() => setDirty(true)}>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <div className="max-w-xl space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={user.name} required />
          </div>
          <div className="max-w-xl space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={user.email} disabled className="bg-sunken" aria-describedby="email-help" />
            <p id="email-help" className="text-xs text-ink-muted">Email cannot be changed.</p>
          </div>
          <div className="max-w-[720px] space-y-2">
            <Label htmlFor="avatarUrl" optional>Avatar URL</Label>
            <Input id="avatarUrl" name="avatarUrl" defaultValue={user.avatarUrl ?? ''} mono />
            <p className="text-xs text-ink-muted">Enter a public image URL, for example <span className="font-mono">https://example.com/avatar.png</span>.</p>
          </div>
        </CardContent>
      </form>
      <UnsavedChangesBar dirty={dirty} pending={loading} onDiscard={() => { formRef.current?.reset(); setDirty(false); setError(null) }} onSave={() => formRef.current?.requestSubmit()} />
    </Card>
  )
}
