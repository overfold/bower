import { getOrganizationDomains, getOrganizationRouteBindings } from '@/lib/domain-queries'
import { hostnameBelongsToDomain } from '@/lib/domains'
import { requireContext } from '@/lib/actions/shared'
import { PageHeading } from '@/components/page-heading'
import { DomainManager } from './domain-manager'

export default async function DomainsSettingsPage() {
  const ctx = await requireContext()
  const [domains, bindings] = await Promise.all([
    getOrganizationDomains(ctx.org.id),
    getOrganizationRouteBindings(ctx.org.id),
  ])

  const rows = domains.map((domain) => ({
    id: domain.id,
    domain: domain.domain,
    verificationToken: domain.verificationToken,
    verifiedAt: domain.verifiedAt?.toISOString() ?? null,
    usage: bindings.filter((binding) => hostnameBelongsToDomain(binding.route.domain, domain.domain)).map((binding) => ({
      routeId: binding.route.id,
      hostname: binding.route.domain,
      projectName: binding.projectName,
      projectSlug: binding.projectSlug,
      environmentName: binding.environmentName,
    })),
  }))

  return (
    <div className="space-y-6">
      <PageHeading
        title="Domains"
        description="Verify domains once for the organization, then bind hostnames to services from each project."
      />
      <DomainManager domains={rows} canManage={ctx.role !== 'member'} />
    </div>
  )
}
