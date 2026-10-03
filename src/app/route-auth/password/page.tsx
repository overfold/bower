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
  const invalidPassword = error === 'invalid-password'
  let hostname: string | null = null
  try { if (returnTo) hostname = new URL(returnTo).hostname } catch { /* Invalid requests are explained below. */ }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-sunken px-4 py-12 [color-scheme:light]">
      <section className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-card">
        <div className="space-y-1">
          <h1 className="break-all text-lg font-semibold tracking-tight text-ink">{hostname ?? 'Protected site'}</h1>
          <p className="text-sm leading-6 text-ink-muted">This site is password protected.</p>
        </div>
        {validRequest ? (
          <form action="/api/route-auth/password" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="route" value={route} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="space-y-2">
              <Label htmlFor="route-password">Password</Label>
              <Input
                id="route-password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                aria-invalid={invalidPassword}
                aria-describedby={invalidPassword ? 'route-password-error' : undefined}
              />
              {invalidPassword ? (
                <p id="route-password-error" role="alert" className="text-sm text-danger-500">
                  Incorrect password. Try again.
                </p>
              ) : null}
            </div>
            <Button variant="primary" type="submit" className="w-full" size="md">Continue</Button>
          </form>
        ) : (
          <InlineNotice tone="error" className="mt-6">This route authorization request is invalid.</InlineNotice>
        )}
        <p className="mt-6 text-center text-xs text-ink-muted">Protected by Bower</p>
      </section>
    </main>
  )
}
