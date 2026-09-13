import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { organizationDomains } from '@/db/domain-schema'
import { environments, projects, routes } from '@/db/schema'

export async function getOrganizationDomains(orgId: string) {
  return db.select().from(organizationDomains)
    .where(eq(organizationDomains.orgId, orgId)).orderBy(asc(organizationDomains.domain))
}

export async function getVerifiedOrganizationDomains(orgId: string) {
  const rows = await getOrganizationDomains(orgId)
  return rows.filter((domain) => domain.verifiedAt !== null)
}

export async function getOrganizationRouteBindings(orgId: string) {
  return db.select({
    route: routes,
    projectName: projects.name,
    projectSlug: projects.slug,
    environmentName: environments.name,
  }).from(routes)
    .innerJoin(projects, eq(projects.id, routes.projectId))
    .innerJoin(environments, eq(environments.id, routes.environmentId))
    .where(eq(projects.orgId, orgId)).orderBy(asc(routes.domain))
}
