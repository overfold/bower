import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  organizations,
  organizationMembers,
  projects,
  environments,
  services,
  serviceConfigs,
  deployments,
  routes,
  teams,
  teamMemberships,
  teamProjectAccess,
  auditLog,
  secretsMetadata,
  webhookEndpoints,
  notificationChannels,
  sidecars,
  apiKeys,
  managedProxies,
  deploymentEvents,
  users,
  sharedSecretGroups,
  sharedSecretMembers,
  organizationTokens,
  instanceTokens,
} from '@/db/schema'

export async function isInstanceAdmin(userId: string) {
  const [user] = await db
    .select({ isInstanceAdmin: users.isInstanceAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return Boolean(user?.isInstanceAdmin)
}

export async function getUserOrganizations(userId: string) {
  const rows = await db
    .select({ org: organizations, membership: organizationMembers })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.orgId))
    .where(eq(organizationMembers.userId, userId))

  if (await isInstanceAdmin(userId)) {
    const allOrgs = await db.select().from(organizations).orderBy(organizations.name)
    const explicitRoles = new Map(rows.map((row) => [row.org.id, row.membership.role]))
    return allOrgs.map((org) => ({
      org,
      role: explicitRoles.get(org.id) ?? ('owner' as const),
      instanceAccess: !explicitRoles.has(org.id),
    }))
  }

  return rows.map((row) => ({ org: row.org, role: row.membership.role, instanceAccess: false }))
}

export async function getUserOrganization(userId: string, preferredOrgId?: string | null) {
  const all = await getUserOrganizations(userId)
  if (all.length === 0) return null
  if (preferredOrgId) {
    const match = all.find((r) => r.org.id === preferredOrgId)
    if (match) return match
  }
  return all[0]
}

export async function getInstanceOrganizations() {
  return db
    .select({
      org: organizations,
      memberCount: sql<number>`count(${organizationMembers.id})::int`,
    })
    .from(organizations)
    .leftJoin(organizationMembers, eq(organizationMembers.orgId, organizations.id))
    .groupBy(organizations.id)
    .orderBy(organizations.name)
}

export async function getInstanceAdmins() {
  return db
    .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.isInstanceAdmin, true))
    .orderBy(users.name)
}

export async function getInstanceTokens() {
  return db
    .select({ token: instanceTokens, createdByName: users.name })
    .from(instanceTokens)
    .leftJoin(users, eq(users.id, instanceTokens.createdByUserId))
    .orderBy(desc(instanceTokens.createdAt))
}

export async function getUserTeams(userId: string, orgId: string) {
  return db
    .select({ team: teams })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(and(eq(teamMemberships.userId, userId), eq(teams.orgId, orgId)))
    .orderBy(teams.name)
    .then((rows) => rows.map((r) => r.team))
}

export async function getProjectsByOrg(orgId: string) {
  return db.select().from(projects).where(eq(projects.orgId, orgId)).orderBy(desc(projects.updatedAt))
}

export async function getProjectsForUser(orgId: string, userId: string, orgRole: 'owner' | 'admin' | 'member') {
  if (orgRole !== 'member') return getProjectsByOrg(orgId)
  return db.selectDistinct({ project: projects }).from(projects)
    .innerJoin(teamProjectAccess, eq(teamProjectAccess.projectId, projects.id))
    .innerJoin(teamMemberships, and(eq(teamMemberships.teamId, teamProjectAccess.teamId), eq(teamMemberships.userId, userId)))
    .where(eq(projects.orgId, orgId)).orderBy(desc(projects.updatedAt)).then((rows) => rows.map((row) => row.project))
}

export async function getProjectBySlug(orgId: string, slug: string) {
  const rows = await db.select().from(projects).where(and(eq(projects.orgId, orgId), eq(projects.slug, slug))).limit(1)
  return rows[0] ?? null
}

export async function getServicesByProject(projectId: string) {
  return db.select().from(services).where(eq(services.projectId, projectId)).orderBy(services.name)
}

export async function getServicesForOrg(orgId: string) {
  return db.select({ service: services, project: projects }).from(services)
    .innerJoin(projects, eq(projects.id, services.projectId)).where(eq(projects.orgId, orgId)).orderBy(services.name)
}

export async function getEnvironmentsByProject(projectId: string) {
  return db.select().from(environments).where(eq(environments.projectId, projectId)).orderBy(environments.promotionOrder)
}

export async function getServiceConfigs(serviceId: string) {
  return db.select().from(serviceConfigs).where(eq(serviceConfigs.serviceId, serviceId))
}

export async function getServiceBySlug(projectId: string, slug: string) {
  const rows = await db.select().from(services).where(and(eq(services.projectId, projectId), eq(services.slug, slug))).limit(1)
  return rows[0] ?? null
}

export async function getServiceConfigsWithEnvironments(serviceId: string) {
  return db.select({ config: serviceConfigs, environment: environments }).from(serviceConfigs)
    .innerJoin(environments, eq(environments.id, serviceConfigs.environmentId))
    .where(eq(serviceConfigs.serviceId, serviceId)).orderBy(environments.promotionOrder)
}

export async function getSidecars(serviceConfigId: string) {
  return db.select().from(sidecars).where(eq(sidecars.serviceConfigId, serviceConfigId))
}

export async function getDeploymentsByService(serviceId: string, limit = 20) {
  return db.select().from(deployments).where(eq(deployments.serviceId, serviceId)).orderBy(desc(deployments.createdAt)).limit(limit)
}

export async function getDeploymentsByProject(projectId: string, limit = 50) {
  const svcIds = await db.select({ id: services.id }).from(services).where(eq(services.projectId, projectId))
  if (svcIds.length === 0) return []
  const { inArray } = await import('drizzle-orm')
  return db.select({
    deployment: deployments, serviceName: services.name, serviceSlug: services.slug,
    environmentName: environments.name, userName: users.name,
  }).from(deployments)
    .innerJoin(services, eq(services.id, deployments.serviceId))
    .innerJoin(environments, eq(environments.id, deployments.environmentId))
    .leftJoin(users, eq(users.id, deployments.triggeredByUserId))
    .where(inArray(deployments.serviceId, svcIds.map((s) => s.id)))
    .orderBy(desc(deployments.createdAt)).limit(limit)
}

export async function getDeploymentsForOrg(orgId: string, limit = 50) {
  const projectIds = await db.select({ id: projects.id }).from(projects).where(eq(projects.orgId, orgId))
  if (projectIds.length === 0) return []
  const { inArray } = await import('drizzle-orm')
  const svcIds = await db.select({ id: services.id }).from(services).where(inArray(services.projectId, projectIds.map((p) => p.id)))
  if (svcIds.length === 0) return []
  return db.select({
    deployment: deployments, serviceName: services.name, serviceSlug: services.slug,
    environmentName: environments.name, projectName: projects.name, projectSlug: projects.slug, userName: users.name,
  }).from(deployments)
    .innerJoin(services, eq(services.id, deployments.serviceId))
    .innerJoin(projects, eq(projects.id, services.projectId))
    .innerJoin(environments, eq(environments.id, deployments.environmentId))
    .leftJoin(users, eq(users.id, deployments.triggeredByUserId))
    .where(inArray(deployments.serviceId, svcIds.map((s) => s.id)))
    .orderBy(desc(deployments.createdAt)).limit(limit)
}

export async function getRoutesByProject(projectId: string) {
  return db.select({ route: routes, serviceName: services.name, environmentName: environments.name }).from(routes)
    .innerJoin(services, eq(services.id, routes.serviceId)).innerJoin(environments, eq(environments.id, routes.environmentId))
    .where(eq(routes.projectId, projectId)).orderBy(routes.domain)
}

export async function getManagedProxies(projectId: string) {
  return db.select({ proxy: managedProxies, environmentName: environments.name }).from(managedProxies)
    .innerJoin(environments, eq(environments.id, managedProxies.environmentId)).where(eq(environments.projectId, projectId))
}

export async function getManagedProxiesForOrg(orgId: string) {
  return db.select({ proxy: managedProxies, environmentName: environments.name, projectName: projects.name }).from(managedProxies)
    .innerJoin(environments, eq(environments.id, managedProxies.environmentId))
    .innerJoin(projects, eq(projects.id, environments.projectId))
    .where(eq(projects.orgId, orgId)).orderBy(environments.promotionOrder)
}

export async function getRouteCountsByEnvironment(orgId: string) {
  return db.select({ environmentId: routes.environmentId, count: sql<number>`count(*)::int` }).from(routes)
    .innerJoin(projects, eq(projects.id, routes.projectId)).where(eq(projects.orgId, orgId)).groupBy(routes.environmentId)
}

export async function getDeploymentEvents(deploymentIds: string[]) {
  if (!deploymentIds.length) return []
  const { inArray } = await import('drizzle-orm')
  return db.select().from(deploymentEvents).where(inArray(deploymentEvents.deploymentId, deploymentIds)).orderBy(deploymentEvents.createdAt)
}

export async function getTeamsByOrg(orgId: string) {
  return db.select().from(teams).where(eq(teams.orgId, orgId)).orderBy(teams.name)
}

export async function getTeamMembers(teamId: string) {
  return db.select({ membership: teamMemberships, userName: users.name, userEmail: users.email }).from(teamMemberships)
    .innerJoin(users, eq(users.id, teamMemberships.userId)).where(eq(teamMemberships.teamId, teamId))
}

export async function getTeamProjectAccessList(teamId: string) {
  return db.select({ access: teamProjectAccess, projectName: projects.name, projectSlug: projects.slug }).from(teamProjectAccess)
    .innerJoin(projects, eq(projects.id, teamProjectAccess.projectId)).where(eq(teamProjectAccess.teamId, teamId))
}

export async function getOrgMembers(orgId: string) {
  return db.select({
    membership: organizationMembers, userName: users.name, userEmail: users.email, userAvatar: users.avatarUrl,
  }).from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.orgId, orgId)).orderBy(users.name)
}

export async function getAuditLog(orgId: string, limit = 50) {
  return db.select({ entry: auditLog, userName: users.name }).from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId)).where(eq(auditLog.orgId, orgId)).orderBy(desc(auditLog.createdAt)).limit(limit)
}

export async function getSecretsByProject(projectId: string) {
  return db.select({ secret: secretsMetadata, environmentName: environments.name, sharedName: sharedSecretGroups.name })
    .from(secretsMetadata).innerJoin(environments, eq(environments.id, secretsMetadata.environmentId))
    .leftJoin(sharedSecretMembers, eq(sharedSecretMembers.secretMetadataId, secretsMetadata.id))
    .leftJoin(sharedSecretGroups, eq(sharedSecretGroups.id, sharedSecretMembers.groupId))
    .where(eq(secretsMetadata.projectId, projectId)).orderBy(environments.promotionOrder, secretsMetadata.name)
}

export async function getProjectIntegrations(projectId: string) {
  const serviceIds = await db.select({ id: services.id }).from(services).where(eq(services.projectId, projectId))
  const hooks = serviceIds.length
    ? await db.select({ hook: webhookEndpoints, serviceName: services.name, environmentName: environments.name }).from(webhookEndpoints)
      .innerJoin(services, eq(services.id, webhookEndpoints.serviceId))
      .innerJoin(environments, eq(environments.id, webhookEndpoints.environmentId))
      .where((await import('drizzle-orm')).inArray(webhookEndpoints.serviceId, serviceIds.map((s) => s.id)))
    : []
  const channels = await db.select().from(notificationChannels).where(eq(notificationChannels.projectId, projectId))
  return { hooks, channels }
}

export async function getApiKeys(userId: string) {
  return db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt))
}

export async function getOrganizationTokens(orgId: string) {
  return db.select({ token: organizationTokens, createdByName: users.name }).from(organizationTokens)
    .leftJoin(users, eq(users.id, organizationTokens.createdByUserId))
    .where(eq(organizationTokens.orgId, orgId)).orderBy(desc(organizationTokens.createdAt))
}
