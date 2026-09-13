'use server'

import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { organizationDomains } from '@/db/domain-schema'
import { environments } from '@/db/schema'
import { getOrganizationRouteBindings } from '@/lib/domain-queries'
import { hostnamesOverlap, routeHostnameForDomain } from '@/lib/domains'
import { createRouteAction, deleteRouteAction } from './operations'
import { requireProject, text } from './shared'

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
