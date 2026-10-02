import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isInstanceAdmin } from '@/lib/queries'
import { SettingsNav } from './settings-nav'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const showInstance = await isInstanceAdmin(user.id)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
      <div className="grid gap-8 md:grid-cols-[180px_minmax(0,1fr)]">
        <SettingsNav showInstance={showInstance} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
