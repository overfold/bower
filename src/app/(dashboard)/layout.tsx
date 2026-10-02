import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ORG_COOKIE_NAME } from '@/lib/constants'
import { getUserOrganizations, getUserOrganization, getUserTeams, getProjectsForUser, getServicesForOrg, isInstanceAdmin, getDeploymentsForOrg, getOrgMembers } from '@/lib/queries'
import { Sidebar } from '@/components/sidebar'
import { HeaderBar } from '@/components/header-bar'
import { PageTransition } from '@/components/page-transition'
import { FeedbackProvider } from '@/components/ui/feedback'
import { TrellisReadErrorProvider } from '@/components/trellis-read-error'
import { getTrellisClient } from '@/lib/trellis-instance'
import { trellisReadError } from '@/lib/trellis-runtime'
import { formatTimestamp } from '@/lib/format'

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

  const [teams, userProjects, orgServices, instanceAdmin, deployments, members] = await Promise.all([
    getUserTeams(user.id, orgCtx.org.id),
    getProjectsForUser(orgCtx.org.id, user.id, orgCtx.role as 'owner' | 'admin' | 'member'),
    getServicesForOrg(orgCtx.org.id),
    isInstanceAdmin(user.id),
    getDeploymentsForOrg(orgCtx.org.id, 250),
    getOrgMembers(orgCtx.org.id),
  ])
  const accessibleProjectIds = new Set(userProjects.map((project) => project.id))
  const accessibleProjectSlugs = new Set(userProjects.map((project) => project.slug))
  const visibleServices = orgServices.filter(({ project }) => accessibleProjectIds.has(project.id))
  const visibleDeployments = deployments.filter((deployment) => accessibleProjectSlugs.has(deployment.projectSlug))
  let trellisError: string | null = null
  try {
    const client = await getTrellisClient(orgCtx.org.id)
    await client.listNodes()
  } catch (error) {
    trellisError = trellisReadError(error)
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
    <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-surface px-3 py-2 text-sm font-medium shadow-pop focus:translate-y-0">Skip to content</a>
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
        projects={userProjects.map((project) => ({ id: project.id, name: project.name, slug: project.slug }))}
        currentOrg={currentOrg}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[236px]">
        <HeaderBar
          orgs={orgs}
          currentOrg={currentOrg}
          teams={teams}
          projects={userProjects.map((project) => ({ id: project.id, name: project.name, slug: project.slug }))}
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
            deploymentLabels: Object.fromEntries(visibleDeployments.map((row) => [row.deployment.id, `${row.deployment.imageAfter} · ${formatTimestamp(row.deployment.createdAt)}`])),
            memberLabels: Object.fromEntries(members.map((member) => [member.membership.userId, member.userName])),
          }}
        />
        <TrellisReadErrorProvider message={trellisError}>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
        </TrellisReadErrorProvider>
      </div>
    </div>
    </FeedbackProvider>
  )
}
