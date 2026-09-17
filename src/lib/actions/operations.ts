'use server'

import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import {
  environments, routes, secretsMetadata, services, teams, teamMemberships,
  teamProjectAccess, users, projects, serviceConfigs,
  sharedSecretGroups, sharedSecretMembers, organizationMembers,
  projectUserAccess,
} from '@/db/schema'
import { getTrellisClient } from '@/lib/trellis-instance'
import { integer, recordAudit, requireContext, requireProject, text } from './shared'
import { syncManagedProxy } from '@/lib/managed-proxy'

export async function createEnvironmentAction(projectId: string, formData: FormData) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const name = text(formData, 'name')
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!slug) throw new Error('Environment name is required.')
  const [last] = await db.select().from(environments).where(eq(environments.projectId, projectId))
    .orderBy(desc(environments.promotionOrder)).limit(1)
  let env: typeof environments.$inferSelect
  try {
    ;[env] = await db.insert(environments).values({
      projectId, name, slug, trellisNamespace: `${ctx.project.slug}-${slug}`,
      promotionOrder: (last?.promotionOrder ?? -1) + 1,
      defaultReplicas: Math.max(0, integer(formData, 'replicas', 1)),
      resourceTier: (text(formData, 'resourceTier') || 'small') as 'small' | 'medium' | 'large' | 'xl' | 'custom',
      envVars: {},
    }).returning()
  } catch { throw new Error('An environment with this name already exists.') }
  const submitted = parseLines(text(formData, 'envVars'))
  if (Object.keys(submitted).length) {
    const envVars = await storeEnvironmentVariables(ctx.org.id, env, submitted)
    await db.update(environments).set({ envVars }).where(eq(environments.id, env.id))
  }
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'environment.created', resourceType: 'environment', resourceId: env.id, details: { name } })
  revalidatePath(`/projects/${ctx.project.slug}/environments`)
}

function parseLines(value: string) {
  const record: Record<string, string> = {}
  for (const line of value.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const at = line.indexOf('='); if (at < 1) throw new Error(`Invalid key/value line: ${line}`)
    record[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return record
}

async function storeEnvironmentVariables(orgId: string, environment: { trellisNamespace: string; envVars: unknown }, submitted: Record<string, string>) {
  const existing = environment.envVars as Record<string, string>
  const client = await getTrellisClient(orgId); const metadata: Record<string, string> = {}
  for (const [name, value] of Object.entries(submitted)) {
    const secretName = `BOWER_ENV_${name}`; metadata[name] = secretName
    if (value) await client.setSecret(environment.trellisNamespace, secretName, value)
    else if (!existing[name]) throw new Error(`A value is required for new environment variable ${name}.`)
  }
  for (const [name, secretName] of Object.entries(existing)) if (!(name in metadata)) await client.deleteSecret(environment.trellisNamespace, secretName).catch(() => undefined)
  return metadata
}

export async function updateEnvironmentAction(projectId: string, environmentId: string, formData: FormData) {
  const ctx = await requireProject(projectId); if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [before] = await db.select().from(environments).where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId))).limit(1)
  if (!before) throw new Error('Environment not found.')
  const envVars = await storeEnvironmentVariables(ctx.org.id, before, parseLines(text(formData, 'envVars')))
  const after = { defaultReplicas: Math.max(0, integer(formData, 'replicas', 1)), promotionOrder: Math.max(0, integer(formData, 'promotionOrder', before.promotionOrder)), resourceTier: (text(formData, 'resourceTier') || 'small') as 'small' | 'medium' | 'large' | 'xl' | 'custom', envVars, updatedAt: new Date() }
  await db.update(environments).set(after).where(eq(environments.id, environmentId))
  const tierResources = { small: [100, 134217728], medium: [250, 268435456], large: [500, 536870912], xl: [1000, 1073741824] } as const
  if (after.resourceTier !== 'custom') await db.update(serviceConfigs).set({ resourceTier: after.resourceTier, cpu: tierResources[after.resourceTier][0], memory: tierResources[after.resourceTier][1], updatedAt: new Date() }).where(eq(serviceConfigs.environmentId, environmentId))
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'environment.updated', resourceType: 'environment', resourceId: environmentId, details: { before, after } })
  revalidatePath(`/projects/${ctx.project.slug}/environments`)
}

export async function deleteEnvironmentAction(projectId: string, environmentId: string) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [service] = await db.select({ id: services.id }).from(services).where(eq(services.projectId, projectId)).limit(1)
  if (service) throw new Error('Delete project services before removing environments.')
  const [environment] = await db.select().from(environments).where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId))).limit(1)
  if (!environment) return
  const client = await getTrellisClient(ctx.org.id)
  await client.deleteJob('bower-proxy', environment.trellisNamespace).catch(() => undefined)
  const secrets = await client.listSecrets(environment.trellisNamespace).catch(() => [])
  await Promise.allSettled(secrets.map((secret) => client.deleteSecret(environment.trellisNamespace, secret.name)))
  await db.delete(environments).where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId)))
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'environment.deleted', resourceType: 'environment', resourceId: environmentId })
  revalidatePath(`/projects/${ctx.project.slug}/environments`)
}

export async function createRouteAction(projectId: string, formData: FormData) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const domain = text(formData, 'domain').toLowerCase()
  const serviceId = text(formData, 'serviceId')
  const environmentId = text(formData, 'environmentId')
  const port = integer(formData, 'port', 8080)
  if (!domain || !serviceId || !environmentId) throw new Error('Domain, service, and environment are required.')
  if (!/^(?:\*\.)?[a-z0-9.-]+$/i.test(domain)) throw new Error('Enter a valid domain name.')
  if (text(formData, 'tlsMode') === 'custom' && (!text(formData, 'tlsCertSecret') || !text(formData, 'tlsKeySecret'))) throw new Error('Custom TLS requires certificate and key secret names.')
  const [service] = await db.select().from(services)
    .where(and(eq(services.id, serviceId), eq(services.projectId, projectId))).limit(1)
  const [environment] = await db.select().from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId))).limit(1)
  if (!service || !environment) throw new Error('Invalid route target.')
  if (text(formData, 'tlsMode') === 'custom') {
    const secretRows = await db.select({ name: secretsMetadata.trellisSecretName }).from(secretsMetadata).where(eq(secretsMetadata.environmentId, environmentId)); const available = new Set(secretRows.map((item) => item.name))
    if (!available.has(text(formData, 'tlsCertSecret')) || !available.has(text(formData, 'tlsKeySecret'))) throw new Error('Custom TLS secrets must exist in the selected environment.')
  }
  const [route] = await db.insert(routes).values({
    projectId, serviceId, environmentId, domain,
    pathPrefix: text(formData, 'pathPrefix') || '/', port,
    tlsMode: text(formData, 'tlsMode') as 'auto' | 'custom' | 'none',
    headers: parseLines(text(formData, 'requestHeaders')),
    responseHeaders: parseLines(text(formData, 'responseHeaders')),
    rateLimit: integer(formData, 'rateLimit', 0) || null,
    redirects: parseRedirects(text(formData, 'redirects')),
    tlsCertSecret: text(formData, 'tlsCertSecret') || null,
    tlsKeySecret: text(formData, 'tlsKeySecret') || null,
  }).returning()
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'route.created',
    resourceType: 'route', resourceId: route.id, details: { domain, service: service.slug } })
  await syncManagedProxy(projectId, environmentId, ctx.org.id)
  revalidatePath(`/projects/${ctx.project.slug}/routes`)
}

function parseRedirects(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [from, to, code] = line.split(/\s+/); if (!from || !to) throw new Error(`Invalid redirect: ${line}`)
    return { from, to, code: code ? Number(code) : 308 }
  })
}

export async function updateRouteAction(projectId: string, routeId: string, formData: FormData) {
  const ctx = await requireProject(projectId); if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [before] = await db.select().from(routes).where(and(eq(routes.id, routeId), eq(routes.projectId, projectId))).limit(1); if (!before) throw new Error('Route not found.')
  if (text(formData, 'tlsMode') === 'custom' && (!text(formData, 'tlsCertSecret') || !text(formData, 'tlsKeySecret'))) throw new Error('Custom TLS requires certificate and key secret names.')
  if (text(formData, 'tlsMode') === 'custom') {
    const secretRows = await db.select({ name: secretsMetadata.trellisSecretName }).from(secretsMetadata).where(eq(secretsMetadata.environmentId, before.environmentId)); const available = new Set(secretRows.map((item) => item.name))
    if (!available.has(text(formData, 'tlsCertSecret')) || !available.has(text(formData, 'tlsKeySecret'))) throw new Error('Custom TLS secrets must exist in this environment.')
  }
  const after = { domain: text(formData, 'domain').toLowerCase(), pathPrefix: text(formData, 'pathPrefix') || '/', port: integer(formData, 'port', 8080), tlsMode: text(formData, 'tlsMode') as 'auto' | 'custom' | 'none', headers: parseLines(text(formData, 'requestHeaders')), responseHeaders: parseLines(text(formData, 'responseHeaders')), rateLimit: integer(formData, 'rateLimit', 0) || null, redirects: parseRedirects(text(formData, 'redirects')), tlsCertSecret: text(formData, 'tlsCertSecret') || null, tlsKeySecret: text(formData, 'tlsKeySecret') || null, updatedAt: new Date() }
  await db.update(routes).set(after).where(eq(routes.id, routeId)); await syncManagedProxy(projectId, before.environmentId, ctx.org.id)
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'route.updated', resourceType: 'route', resourceId: routeId, details: { before, after } }); revalidatePath(`/projects/${ctx.project.slug}/routes`)
}

export async function deleteRouteAction(projectId: string, routeId: string) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [route] = await db.select().from(routes).where(and(eq(routes.id, routeId), eq(routes.projectId, projectId))).limit(1)
  await db.delete(routes).where(and(eq(routes.id, routeId), eq(routes.projectId, projectId)))
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'route.deleted',
    resourceType: 'route', resourceId: routeId })
  if (route) await syncManagedProxy(projectId, route.environmentId, ctx.org.id)
  revalidatePath(`/projects/${ctx.project.slug}/routes`)
}

export async function setSecretAction(projectId: string, formData: FormData) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const environmentId = text(formData, 'environmentId')
  const name = text(formData, 'name').toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const value = text(formData, 'value')
  const [environment] = await db.select().from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId))).limit(1)
  if (!environment || !name || !value) throw new Error('Environment, name, and value are required.')
  try {
    const client = await getTrellisClient(ctx.org.id)
    await client.setSecret(environment.trellisNamespace, name, value)
    const [metadata] = await db.insert(secretsMetadata).values({ projectId, environmentId, name,
      trellisSecretName: name, lastRotatedAt: new Date() }).onConflictDoUpdate({
        target: [secretsMetadata.environmentId, secretsMetadata.name],
        set: { lastRotatedAt: new Date(), updatedAt: new Date() },
      }).returning()
    const sharedName = text(formData, 'sharedName')
    if (sharedName) {
      let [group] = await db.select().from(sharedSecretGroups).where(and(eq(sharedSecretGroups.projectId, projectId), eq(sharedSecretGroups.name, sharedName))).limit(1)
      if (!group) [group] = await db.insert(sharedSecretGroups).values({ projectId, name: sharedName }).returning()
      await db.insert(sharedSecretMembers).values({ groupId: group.id, secretMetadataId: metadata.id }).onConflictDoNothing()
    }
    await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'secret.rotated',
      resourceType: 'secret', resourceId: `${environmentId}:${name}`, details: { name, sharedName } })
  } catch (error) { throw new Error(error instanceof Error ? error.message : 'Could not store secret.') }
  revalidatePath(`/projects/${ctx.project.slug}/secrets`)
}

export async function deleteSecretAction(projectId: string, secretId: string) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [row] = await db.select({ secret: secretsMetadata, env: environments })
    .from(secretsMetadata).innerJoin(environments, eq(environments.id, secretsMetadata.environmentId))
    .where(and(eq(secretsMetadata.id, secretId), eq(secretsMetadata.projectId, projectId))).limit(1)
  if (!row) return
  const configs = await db.select().from(serviceConfigs).where(eq(serviceConfigs.environmentId, row.secret.environmentId))
  const consumers = configs.filter((config) => (config.secretBindings as Array<{ name: string }>).some((binding) => binding.name === row.secret.trellisSecretName))
  if (consumers.length) throw new Error(`Secret is referenced by ${consumers.length} service configuration${consumers.length === 1 ? '' : 's'}. Remove those bindings first.`)
  const routeConsumers = (await db.select().from(routes).where(eq(routes.environmentId, row.secret.environmentId))).filter((route) => route.tlsCertSecret === row.secret.trellisSecretName || route.tlsKeySecret === row.secret.trellisSecretName)
  if (routeConsumers.length) throw new Error('Secret is referenced by a custom TLS route. Change the route first.')
  const client = await getTrellisClient(ctx.org.id)
  await client.deleteSecret(row.env.trellisNamespace, row.secret.trellisSecretName)
  await db.delete(secretsMetadata).where(eq(secretsMetadata.id, secretId))
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'secret.deleted',
    resourceType: 'secret', resourceId: secretId, details: { name: row.secret.name } })
  revalidatePath(`/projects/${ctx.project.slug}/secrets`)
}

export async function setNodeDrainAction(nodeId: string, drain: boolean) {
  const ctx = await requireContext()
  if (ctx.role !== 'owner') throw new Error('Only organization owners can change node state.')
  try {
    const client = await getTrellisClient(ctx.org.id)
    if (drain) await client.drainNode(nodeId); else await client.undrainNode(nodeId)
    await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id,
      action: drain ? 'node.drained' : 'node.undrained', resourceType: 'node', resourceId: nodeId })
  } catch (error) { throw new Error(error instanceof Error ? error.message : 'Node action failed.') }
  revalidatePath('/cluster')
}

export async function createTeamAction(formData: FormData) {
  const ctx = await requireContext()
  if (ctx.role !== 'owner' && ctx.role !== 'admin') throw new Error('Insufficient permissions.')
  const name = text(formData, 'name')
  if (!name) throw new Error('Team name is required.')
  const [team] = await db.insert(teams).values({ orgId: ctx.org.id, name }).returning()
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'team.created',
    resourceType: 'team', resourceId: team.id, details: { name } })
  revalidatePath('/settings/teams')
}

export async function addTeamMemberAction(teamId: string, formData: FormData) {
  const ctx = await requireContext()
  if (ctx.role !== 'owner' && ctx.role !== 'admin') throw new Error('Insufficient permissions.')
  const email = text(formData, 'email').toLowerCase()
  const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.org.id))).limit(1)
  const [member] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!team || !member) throw new Error('No organization user has that email.')
  await db.insert(teamMemberships).values({ teamId, userId: member.id }).onConflictDoNothing()
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'team.member.added', resourceType: 'team', resourceId: teamId, details: { memberId: member.id, email } })
  revalidatePath('/settings/teams')
}

export async function grantTeamProjectAction(teamId: string, formData: FormData) {
  const ctx = await requireContext()
  if (ctx.role !== 'owner' && ctx.role !== 'admin') throw new Error('Insufficient permissions.')
  const projectId = text(formData, 'projectId')
  const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.org.id))).limit(1)
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.orgId, ctx.org.id))).limit(1)
  if (!project || !team) throw new Error('Team and project are required.')
  await db.insert(teamProjectAccess).values({ teamId, projectId,
    role: text(formData, 'role') as 'admin' | 'deployer' | 'viewer' }).onConflictDoUpdate({
      target: [teamProjectAccess.teamId, teamProjectAccess.projectId],
      set: { role: text(formData, 'role') as 'admin' | 'deployer' | 'viewer' },
    })
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'team.project.granted', resourceType: 'team', resourceId: teamId, details: { projectId, role: text(formData, 'role') } })
  revalidatePath('/settings/teams')
}

export async function removeTeamMemberAction(teamId: string, membershipId: string) {
  const ctx = await requireContext(); if (ctx.role === 'member') throw new Error('Insufficient permissions.')
  const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.org.id))).limit(1); if (!team) throw new Error('Team not found.')
  await db.delete(teamMemberships).where(and(eq(teamMemberships.id, membershipId), eq(teamMemberships.teamId, teamId)))
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'team.member.removed', resourceType: 'team', resourceId: teamId, details: { membershipId } }); revalidatePath('/settings/teams')
}

export async function revokeTeamProjectAction(teamId: string, accessId: string) {
  const ctx = await requireContext(); if (ctx.role === 'member') throw new Error('Insufficient permissions.')
  const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.org.id))).limit(1); if (!team) throw new Error('Team not found.')
  await db.delete(teamProjectAccess).where(and(eq(teamProjectAccess.id, accessId), eq(teamProjectAccess.teamId, teamId)))
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'team.project.revoked', resourceType: 'team', resourceId: teamId, details: { accessId } }); revalidatePath('/settings/teams')
}

export async function deleteTeamAction(teamId: string) {
  const ctx = await requireContext(); if (ctx.role === 'member') throw new Error('Insufficient permissions.')
  await db.update(projects).set({ owningTeamId: null }).where(eq(projects.owningTeamId, teamId)); await db.delete(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.org.id)))
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'team.deleted', resourceType: 'team', resourceId: teamId }); revalidatePath('/settings/teams')
}

export async function addOrganizationMemberAction(formData: FormData) {
  const ctx = await requireContext(); if (ctx.role !== 'owner') throw new Error('Only owners can manage organization membership.')
  const email = text(formData, 'email').toLowerCase(); const [member] = await db.select().from(users).where(eq(users.email, email)).limit(1); if (!member) throw new Error('That user must register before being added.')
  const role = text(formData, 'role') as 'owner' | 'admin' | 'member'
  await db.insert(organizationMembers).values({ orgId: ctx.org.id, userId: member.id, role }).onConflictDoUpdate({ target: [organizationMembers.orgId, organizationMembers.userId], set: { role } })
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'organization.member.upserted', resourceType: 'organization', resourceId: ctx.org.id, details: { memberId: member.id, email, role } }); revalidatePath('/settings/members')
}

export async function grantProjectAccessAction(projectId: string, formData: FormData) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const kind = text(formData, 'kind')
  const role = text(formData, 'role') as 'admin' | 'deployer' | 'viewer'
  if (!['admin', 'deployer', 'viewer'].includes(role)) throw new Error('Invalid role.')

  if (kind === 'team') {
    const teamId = text(formData, 'teamId')
    const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, ctx.org.id))).limit(1)
    if (!team) throw new Error('Team not found.')
    await db.insert(teamProjectAccess).values({ teamId, projectId, role }).onConflictDoUpdate({
      target: [teamProjectAccess.teamId, teamProjectAccess.projectId],
      set: { role },
    })
    await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'project.access.team.granted', resourceType: 'project', resourceId: projectId, details: { teamId, teamName: team.name, role } })
  } else {
    const email = text(formData, 'email').toLowerCase()
    const [member] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!member) throw new Error('No registered user has that email.')
    await db.insert(projectUserAccess).values({ projectId, userId: member.id, role }).onConflictDoUpdate({
      target: [projectUserAccess.projectId, projectUserAccess.userId],
      set: { role },
    })
    await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'project.access.user.granted', resourceType: 'project', resourceId: projectId, details: { userId: member.id, email, role } })
  }
  revalidatePath(`/projects/${ctx.project.slug}/access`)
}

export async function revokeProjectTeamAccessAction(projectId: string, accessId: string) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  await db.delete(teamProjectAccess).where(and(eq(teamProjectAccess.id, accessId), eq(teamProjectAccess.projectId, projectId)))
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'project.access.team.revoked', resourceType: 'project', resourceId: projectId, details: { accessId } })
  revalidatePath(`/projects/${ctx.project.slug}/access`)
}

export async function revokeProjectUserAccessAction(projectId: string, accessId: string) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  await db.delete(projectUserAccess).where(and(eq(projectUserAccess.id, accessId), eq(projectUserAccess.projectId, projectId)))
  await recordAudit({ orgId: ctx.org.id, userId: ctx.user.id, action: 'project.access.user.revoked', resourceType: 'project', resourceId: projectId, details: { accessId } })
  revalidatePath(`/projects/${ctx.project.slug}/access`)
}

