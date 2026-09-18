'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { registerAction } from '@/lib/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const next = new URLSearchParams(window.location.search).get('next')
    if (next) formData.set('next', next)
    const result = await registerAction(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold tracking-tight">Create account</h2>
        <p className="text-xs leading-relaxed text-ink-muted">
          Create your Bower account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="text-xs leading-relaxed text-danger-500">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Your name" autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
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
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        <Button variant="primary" type="submit" className="mt-1 w-full" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account&hellip;
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      <div className="border-t border-line pt-4">
        <p className="text-center text-[12.5px] text-ink-muted">
          Already have an account?{' '}
          <Link href={`/login${typeof window === 'undefined' ? '' : window.location.search}`} className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
