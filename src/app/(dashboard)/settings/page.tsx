import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isInstanceAdmin } from '@/lib/queries'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  redirect((await isInstanceAdmin(user.id)) ? '/settings/instance' : '/settings/cluster')
}
