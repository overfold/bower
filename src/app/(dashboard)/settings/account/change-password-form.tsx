'use client'

import { useState } from 'react'
import { changePasswordAction } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const newPw = formData.get('newPassword') as string
    const confirm = formData.get('confirmPassword') as string
    if (newPw !== confirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }
    const result = await changePasswordAction(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      e.currentTarget.reset()
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div>}
          {success && <div className="rounded-md bg-brand-50 p-3 text-sm text-brand-700">Password updated.</div>}
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
            <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
          </div>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
