'use client'

import { useRef, useState } from 'react'
import { changePasswordAction } from '@/lib/actions/settings'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, InlineNotice, useFeedback } from '@/components/ui/feedback'

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmationError, setConfirmationError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const confirmationRef = useRef<HTMLInputElement>(null)
  const { toast } = useFeedback()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setError(null)
    setConfirmationError(null)
    setFieldErrors({})
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
      if (result?.fieldErrors) { setFieldErrors(result.fieldErrors); form.querySelector<HTMLElement>(`#${Object.keys(result.fieldErrors)[0]}`)?.focus() }
      else if (result?.error) setError(result.error)
      else if (result?.success) {
        toast({ tone: 'success', title: 'Password updated' })
        form.reset()
      } else setError('Password could not be updated. Please try again.')
    } catch {
      setError('Password could not be updated. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} onInvalid={(event) => { event.preventDefault(); const field = event.target as HTMLInputElement; if (field.name === 'confirmPassword') setConfirmationError(field.validationMessage); else setFieldErrors((current) => ({ ...current, [field.name]: field.validationMessage })); field.form?.querySelector<HTMLElement>(':invalid')?.focus() }}>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required className="max-w-xl" aria-invalid={Boolean(fieldErrors.currentPassword)} aria-describedby={fieldErrors.currentPassword ? 'current-password-error' : undefined} />
            <div id="current-password-error"><FieldError>{fieldErrors.currentPassword}</FieldError></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" required minLength={8} className="max-w-xl" aria-invalid={Boolean(fieldErrors.newPassword)} aria-describedby={fieldErrors.newPassword ? 'new-password-error' : undefined} />
            <div id="new-password-error"><FieldError>{fieldErrors.newPassword}</FieldError></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input ref={confirmationRef} id="confirmPassword" name="confirmPassword" type="password" required minLength={8} className="max-w-xl" aria-invalid={Boolean(confirmationError)} aria-describedby={confirmationError ? 'confirm-password-error' : undefined} />
            <div id="confirm-password-error"><FieldError>{confirmationError}</FieldError></div>
          </div>
        </CardContent>
        <CardFooter><Button variant="primary" type="submit" disabled={loading} loading={loading}>Update password</Button></CardFooter>
      </form>
    </Card>
  )
}
