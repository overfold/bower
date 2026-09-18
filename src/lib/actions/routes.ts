'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { organizationDomains } from '@/db/domain-schema'
import { environments, routes } from '@/db/schema'
import { hashPassword } from '@/lib/auth'
import { getOrganizationRouteBindings } from '@/lib/domain-queries'
import { hostnamesOverlap, routeHostnameForDomain } from '@/lib/domains'
import { syncManagedProxy } from '@/lib/managed-proxy'
import { createRouteAction, deleteRouteAction } from './operations'
import { recordAudit, requireProject, text } from './shared'

export async function createManagedRouteAction(projectId: string, formData: FormData) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')

  const managedDomainId = text(formData, 'managedDomainId')
  const environmentId = text(formData, 'environmentId')
  const prefix = text(formData, 'hostnamePrefix')
  const [managedDomain] = await db.select().from(organizationDomains)
    .where(and(
      eq(organizationDomains.id, managedDomainId),
      eq(organizationDomains.orgId, ctx.org.id),
    )).limit(1)
  if (!managedDomain?.verifiedAt) throw new Error('Choose a verified organization domain.')

  const [environment] = await db.select({ id: environments.id }).from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId))).limit(1)
  if (!environment) throw new Error('Invalid route environment.')

  const hostname = routeHostnameForDomain(managedDomain.domain, prefix)
  const bindings = await getOrganizationRouteBindings(ctx.org.id)
  const conflict = bindings.find((binding) =>
    hostnamesOverlap(binding.route.domain, hostname) &&
    (binding.route.projectId !== projectId || binding.route.environmentId !== environmentId),
  )
  if (conflict) {
    throw new Error(`${hostname} overlaps a hostname already claimed by ${conflict.projectName} / ${conflict.environmentName}.`)
  }

  formData.set('domain', hostname)
  return createRouteAction(projectId, formData)
}

export async function deleteManagedRouteAction(projectId: string, routeId: string) {
  return deleteRouteAction(projectId, routeId)
}

export async function updateRouteProtectionAction(projectId: string, routeId: string, formData: FormData) {
  const ctx = await requireProject(projectId)
  if (ctx.projectRole !== 'admin') throw new Error('Insufficient permissions.')
  const [route] = await db.select().from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.projectId, projectId))).limit(1)
  if (!route) throw new Error('Route not found.')

  const protectionMode = text(formData, 'protectionMode') as 'none' | 'password' | 'bower_auth'
  const password = text(formData, 'routePassword')
  if (!['none', 'password', 'bower_auth'].includes(protectionMode)) throw new Error('Invalid route protection mode.')
  if (protectionMode === 'password' && !route.passwordHash && password.length < 8) {
    throw new Error('Route passwords must be at least 8 characters.')
  }
  if (password && password.length < 8) throw new Error('Route passwords must be at least 8 characters.')
  if (protectionMode !== 'none' && (!process.env.BOWER_PUBLIC_URL || (process.env.BOWER_ROUTE_AUTH_SECRET?.length ?? 0) < 32)) {
    throw new Error('BOWER_PUBLIC_URL and a BOWER_ROUTE_AUTH_SECRET of at least 32 characters are required for protected routes.')
  }

  const passwordHash = protectionMode === 'password'
    ? (password ? await hashPassword(password) : route.passwordHash)
    : null
  await db.update(routes).set({ protectionMode, passwordHash, updatedAt: new Date() })
    .where(eq(routes.id, routeId))
  await syncManagedProxy(projectId, route.environmentId, ctx.org.id)
  await recordAudit({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    action: 'route.protection.updated',
    resourceType: 'route',
    resourceId: routeId,
    details: { before: route.protectionMode, after: protectionMode },
  })
  revalidatePath(`/projects/${ctx.project.slug}/routes`)
}
