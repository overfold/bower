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
      <SettingsNav showInstance={showInstance} />
      {children}
    </div>
  )
}
