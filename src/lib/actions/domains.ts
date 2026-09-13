'use server'

import { randomBytes } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { organizationDomains } from '@/db/domain-schema'
import { getOrganizationDomains, getOrganizationRouteBindings } from '@/lib/domain-queries'
import { hostnameBelongsToDomain, normalizeManagedDomain } from '@/lib/domains'
import { recordAudit, requireContext } from './shared'

async function requireOrganizationManager() {
  const ctx = await requireContext()
  if (ctx.role === 'member') throw new Error('Insufficient permissions.')
  return ctx
}

export async function createOrganizationDomainAction(domainInput: string) {
  try {
    const ctx = await requireOrganizationManager()
    const domain = normalizeManagedDomain(domainInput)
    const [existing] = await db.select().from(organizationDomains)
      .where(and(eq(organizationDomains.orgId, ctx.org.id), eq(organizationDomains.domain, domain))).limit(1)
    if (existing) return { error: 'This domain is already registered to the organization.' }

    const verificationToken = randomBytes(24).toString('base64url')
    const [created] = await db.insert(organizationDomains)
      .values({ orgId: ctx.org.id, domain, verificationToken }).returning()

    await recordAudit({
      orgId: ctx.org.id, userId: ctx.user.id, action: 'domain.created',
      resourceType: 'domain', resourceId: created.id, details: { domain },
    })
    revalidatePath('/settings/domains')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not add domain.' }
  }
}

export async function verifyOrganizationDomainAction(domainId: string) {
  try {
    const ctx = await requireOrganizationManager()
    const [domain] = await db.select().from(organizationDomains)
      .where(and(eq(organizationDomains.id, domainId), eq(organizationDomains.orgId, ctx.org.id))).limit(1)
    if (!domain) return { error: 'Domain not found.' }
    if (domain.verifiedAt) return { success: true }

    const recordName = `_bower.${domain.domain}`
    const expected = `bower-verification=${domain.verificationToken}`
    let values: string[] = []
    try {
      values = (await resolveTxt(recordName)).map((parts) => parts.join(''))
    } catch {
      return { error: `Verification record not found yet. Add the TXT record at ${recordName} and try again.` }
    }
    if (!values.includes(expected)) {
      return { error: 'The TXT record exists, but its verification value does not match.' }
    }

    const verifiedAt = new Date()
    await db.update(organizationDomains).set({ verifiedAt, updatedAt: verifiedAt })
      .where(eq(organizationDomains.id, domain.id))
    await recordAudit({
      orgId: ctx.org.id, userId: ctx.user.id, action: 'domain.verified',
      resourceType: 'domain', resourceId: domain.id, details: { domain: domain.domain },
    })
    revalidatePath('/settings/domains')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not verify domain.' }
  }
}

export async function deleteOrganizationDomainAction(domainId: string) {
  try {
    const ctx = await requireOrganizationManager()
    const domains = await getOrganizationDomains(ctx.org.id)
    const domain = domains.find((item) => item.id === domainId)
    if (!domain) return { error: 'Domain not found.' }

    const remainingVerified = domains.filter((item) => item.id !== domain.id && item.verifiedAt)
    const bindings = await getOrganizationRouteBindings(ctx.org.id)
    const consumers = bindings.filter((binding) =>
      hostnameBelongsToDomain(binding.route.domain, domain.domain) &&
      !remainingVerified.some((candidate) => hostnameBelongsToDomain(binding.route.domain, candidate.domain)),
    )
    if (consumers.length) {
      return { error: `Remove the ${consumers.length} route${consumers.length === 1 ? '' : 's'} that rely on this domain before deleting it.` }
    }

    await db.delete(organizationDomains).where(eq(organizationDomains.id, domain.id))
    await recordAudit({
      orgId: ctx.org.id, userId: ctx.user.id, action: 'domain.deleted',
      resourceType: 'domain', resourceId: domain.id, details: { domain: domain.domain },
    })
    revalidatePath('/settings/domains')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not delete domain.' }
  }
}
