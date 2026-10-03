'use client'

import { useState } from 'react'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { registerAction } from '@/lib/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineNotice } from '@/components/ui/feedback'

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    setLoading(true)
    const next = new URLSearchParams(window.location.search).get('next')
    if (next) formData.set('next', next)
    try {
      const result = await registerAction(formData)
      if (result?.error) setError(result.error)
    } catch (error) {
      unstable_rethrow(error)
      setError('Account creation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Create account</h2>
        <p className="text-xs leading-relaxed text-ink-muted">
          Create your Bower account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        <Button variant="primary" type="submit" className="mt-1 w-full" size="md" disabled={loading} aria-busy={loading}>
          {loading ? (
            <>
              Creating account&hellip;
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      <div className="border-t border-line pt-4">
        <p className="text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link href={`/login${typeof window === 'undefined' ? '' : window.location.search}`} className="text-link font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
