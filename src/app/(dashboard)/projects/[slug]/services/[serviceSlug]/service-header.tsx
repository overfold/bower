import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getDeploymentsByService } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { ServiceActions } from './service-actions'
import { ServiceTabs } from './service-tabs'

export async function ServiceHeader({
  slug,
  serviceSlug,
  serviceName,
  serviceId,
  environmentId,
  hasConfig,
}: {
  slug: string
  serviceSlug: string
  serviceName: string
  serviceId: string
  environmentId: string
  hasConfig: boolean
}) {
  const deployments = hasConfig ? await getDeploymentsByService(serviceId, 20) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/projects/${slug}/services`} className="text-ink-muted transition-colors hover:text-ink" aria-label="Back to services">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <PageHeading as="h2" title={serviceName} />
        </div>
        {hasConfig && <ServiceActions
          serviceId={serviceId}
          environmentId={environmentId}
          hasDeployments={deployments.some((deployment) => deployment.environmentId === environmentId && Boolean(deployment.previousJobSpec))}
        />}
      </div>
      <div className="border-b border-line">
        <ServiceTabs slug={slug} serviceSlug={serviceSlug} />
      </div>
    </div>
  )
}
