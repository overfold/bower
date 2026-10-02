'use client'

import { useRef, useState } from 'react'
import { changePasswordAction } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, InlineNotice, useFeedback } from '@/components/ui/feedback'

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmationError, setConfirmationError] = useState<string | null>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)
  const { toast } = useFeedback()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setError(null)
    setConfirmationError(null)
    setLoading(true)
    const newPw = formData.get('newPassword') as string
    const confirm = formData.get('confirmPassword') as string
    if (newPw !== confirm) {
      setConfirmationError('Passwords do not match.')
      setLoading(false)
      confirmationRef.current?.focus()
      return
    }
    try {
      const result = await changePasswordAction(formData)
      if (result?.error) setError(result.error)
      else if (result?.success) {
        toast({ tone: 'success', title: 'Password updated.' })
        form.reset()
        setDirty(false)
      } else setError('Password could not be updated. Please try again.')
    } catch {
      setError('Password could not be updated. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} onChange={() => setDirty(true)}>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input ref={confirmationRef} id="confirmPassword" name="confirmPassword" type="password" required minLength={8} aria-invalid={Boolean(confirmationError)} aria-describedby={confirmationError ? 'confirm-password-error' : undefined} />
            <div id="confirm-password-error"><FieldError>{confirmationError}</FieldError></div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="primary" type="submit" disabled={loading || !dirty} loading={loading}>
            {loading ? 'Saving…' : 'Update password'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
