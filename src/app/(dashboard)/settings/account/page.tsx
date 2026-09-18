import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getApiKeys } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { AccountSettingsForm } from '@/components/account-settings-form'
import { ChangePasswordForm } from './change-password-form'
import { ApiKeysSection } from './api-keys-section'

export default async function AccountSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const apiKeysList = await getApiKeys(user.id)

  return (
    <div className="space-y-8">
      <PageHeading title="Account" description="Manage your profile and API keys." />

      <AccountSettingsForm
        user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      />


      <ChangePasswordForm />


      <ApiKeysSection
        keys={apiKeysList.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
