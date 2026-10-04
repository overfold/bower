import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { logoutAction } from '@/lib/auth-actions'
import { getUserOrganizations } from '@/lib/queries'
import { AuthLayout } from '@/components/auth-layout'
import { Button } from '@/components/ui/button'

export default async function NoOrganizationPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if ((await getUserOrganizations(user.id)).length > 0) redirect('/projects')

  return (
    <AuthLayout>
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-ink">No organization access</h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            Your account does not have access to any organizations. Ask an administrator for an invitation, then open the invitation link to join.
          </p>
        </div>
        <div className="rounded-lg bg-sunken p-3">
          <p className="text-sm font-medium text-ink">Signed in as {user.name}</p>
          <p className="break-all text-xs text-ink-muted">{user.email}</p>
        </div>
        <Button asChild variant="primary" className="w-full">
          <Link href="/projects">Check access</Link>
        </Button>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" className="w-full">Sign out</Button>
        </form>
      </div>
    </AuthLayout>
  )
}
