import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getAuditLog } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { ScrollText } from 'lucide-react'
import { AuditLogList } from './audit-log-list'

export default async function AuditLogPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const orgCtx = await getUserOrganization(user.id)
  if (!orgCtx) redirect('/login')

  const entries = await getAuditLog(orgCtx.org.id)

  const mapped = entries.map((e) => ({
    id: e.entry.id,
    action: e.entry.action,
    resourceType: e.entry.resourceType,
    resourceId: e.entry.resourceId,
    details: (e.entry.details ?? {}) as Record<string, unknown>,
    createdAt: e.entry.createdAt,
    userName: e.userName,
  }))

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <PageHeading
        title="Audit Log"
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
        <Panel>
          <PanelHeader
            title={`${mapped.length} events`}
            hint="Retained for 365 days"
          />
          <AuditLogList entries={mapped} />
        </Panel>
      )}
    </div>
  )
}
