import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getApiKeys, getUserOrganization, getProjectsForUser } from '@/lib/queries'
import { getProjectRole } from '@/lib/actions/shared'
import { db } from '@/db'
import { environments } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { PageHeading } from '@/components/page-heading'
import { AccountSettingsForm } from '@/components/account-settings-form'
import { ChangePasswordForm } from './change-password-form'
import { ApiKeysSection } from './api-keys-section'
import { AppearanceSettings } from './appearance-settings'

export default async function AccountSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const apiKeysList = await getApiKeys(user.id)
  const ctx = await getUserOrganization(user.id)
  const projects = ctx ? await getProjectsForUser(ctx.org.id, user.id, ctx.role) : []
  const choices = await Promise.all(projects.map(async (project) => ({
    id: project.id, name: project.name,
    canWrite: ['admin', 'deployer'].includes(await getProjectRole(user.id, ctx!.role, project.id) ?? ''),
    environments: await db.select({ id: environments.id, name: environments.name }).from(environments)
      .where(eq(environments.projectId, project.id)).orderBy(environments.name),
  })))

  return (
    <div className="space-y-6">
      <PageHeading as="h2" title="Account" />

      <AccountSettingsForm
        user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      />
      <section><AppearanceSettings /></section>
      <section id="password" className="scroll-mt-20"><ChangePasswordForm /></section>
      <section id="api-keys" className="scroll-mt-20"><ApiKeysSection
        projects={choices}
        keys={apiKeysList.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
          projectId: k.projectId,
          environmentId: k.environmentId,
          scopes: k.scopes,
          expiresAt: k.expiresAt?.toISOString() ?? null,
        }))}
      /></section>
    </div>
  )
}
