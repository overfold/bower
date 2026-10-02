import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getAuditLog, getDeploymentsForOrg, getServicesForOrg } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Panel } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { ScrollText } from 'lucide-react'
import { AuditLogList } from './audit-log-list'

export default async function AuditLogPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  // eslint-disable-next-line react-hooks/purity
  const requestTime = Date.now()
  const [entries, services, deployments] = await Promise.all([
    getAuditLog(orgCtx.org.id, null),
    getServicesForOrg(orgCtx.org.id),
    getDeploymentsForOrg(orgCtx.org.id, null),
  ])
  const resourceNames = new Map<string, string>()
  for (const { service, project } of services) {
    resourceNames.set(service.id, service.name)
    resourceNames.set(project.id, project.name)
  }
  for (const deployment of deployments) resourceNames.set(deployment.deployment.id, deployment.serviceName)

  const mapped = entries.map((e) => ({
    id: e.entry.id,
    action: e.entry.action,
    resourceType: e.entry.resourceType,
    resourceId: e.entry.resourceId,
    resourceName: resourceNames.get(e.entry.resourceId),
    details: (e.entry.details ?? {}) as Record<string, unknown>,
    createdAt: e.entry.createdAt,
    userName: e.userName,
  }))

  return (
    <div className="space-y-6">
      <PageHeading
        title="Audit log"
        description="Review changes and actions across the organization."
      />

      {mapped.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<ScrollText className="h-5 w-5" />}
            title="No audit entries"
            body="Actions performed in your organization will appear here."
          />
        </Panel>
      ) : (
        <AuditLogList entries={mapped} now={requestTime} />
      )}
    </div>
  )
}
