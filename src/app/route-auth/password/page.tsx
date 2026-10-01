import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineNotice } from '@/components/ui/feedback'

export default async function RoutePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ route?: string; returnTo?: string; error?: string }>
}) {
  const { route, returnTo, error } = await searchParams
  const validRequest = typeof route === 'string' && typeof returnTo === 'string'

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4 py-8">
      <section className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-raised">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Protected route</h1>
          <p className="text-sm leading-6 text-ink-muted">Enter the password configured for this route to continue.</p>
        </div>
        {validRequest ? (
          <form action="/api/route-auth/password" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="route" value={route} />
            <input type="hidden" name="returnTo" value={returnTo} />
            {error === 'invalid-password' ? <InlineNotice tone="error">Incorrect password. Try again.</InlineNotice> : null}
            <div className="space-y-2">
              <Label htmlFor="route-password">Password</Label>
              <Input id="route-password" name="password" type="password" autoComplete="current-password" autoFocus required />
            </div>
            <Button variant="primary" type="submit" className="w-full" size="lg">Continue</Button>
          </form>
        ) : (
          <InlineNotice tone="error" className="mt-6">This route authorization request is invalid.</InlineNotice>
        )}
      </section>
    </main>
  )
}
