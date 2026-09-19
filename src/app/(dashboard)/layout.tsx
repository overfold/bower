import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ORG_COOKIE_NAME } from '@/lib/constants'
import { getUserOrganizations, getUserOrganization, getUserTeams, getProjectsForUser, getServicesForOrg, isInstanceAdmin } from '@/lib/queries'
import { Sidebar } from '@/components/sidebar'
import { HeaderBar } from '@/components/header-bar'
import { PageTransition } from '@/components/page-transition'
import { FeedbackProvider, PageBanner } from '@/components/ui/feedback'
import { getTrellisClient } from '@/lib/trellis-instance'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const preferredOrgId = cookieStore.get(ORG_COOKIE_NAME)?.value ?? null

  const allOrgs = await getUserOrganizations(user.id)
  if (allOrgs.length === 0) redirect('/login')

  const orgCtx = await getUserOrganization(user.id, preferredOrgId)
  if (!orgCtx) redirect('/login')

  const teams = await getUserTeams(user.id, orgCtx.org.id)
  const userProjects = await getProjectsForUser(orgCtx.org.id, user.id, orgCtx.role as 'owner' | 'admin' | 'member')
  const orgServices = await getServicesForOrg(orgCtx.org.id)
  const accessibleProjectIds = new Set(userProjects.map((project) => project.id))
  const visibleServices = orgServices.filter(({ project }) => accessibleProjectIds.has(project.id))
  const instanceAdmin = await isInstanceAdmin(user.id)
  let trellisError: string | null = null
  try {
    const client = await getTrellisClient(orgCtx.org.id)
    await client.listNodes()
  } catch (error) {
    trellisError = error instanceof Error ? error.message : 'Trellis could not be reached.'
  }

  const orgs = allOrgs.map((entry) => ({
    id: entry.org.id,
    name: entry.org.name,
    slug: entry.org.slug,
    role: entry.role,
  }))

  const currentOrg = {
    id: orgCtx.org.id,
    name: orgCtx.org.name,
    slug: orgCtx.org.slug,
    role: orgCtx.role,
  }

  return (
    <FeedbackProvider>
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[236px]">
        <HeaderBar
          orgs={orgs}
          currentOrg={currentOrg}
          teams={teams}
          user={{
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          }}
          searchData={{
            projects: userProjects.map((p) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              teamName: teams.find((t) => t.id === p.owningTeamId)?.name,
            })),
            services: visibleServices.map(({ service, project }) => ({
              id: service.id,
              name: service.name,
              slug: service.slug,
              projectName: project.name,
              projectSlug: project.slug,
            })),
            orgName: orgCtx.org.name,
            instanceAdmin,
          }}
        />
        {trellisError ? <PageBanner tone="warning" title="Trellis is unavailable.">{trellisError}</PageBanner> : null}
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </div>
    </FeedbackProvider>
  )
}
