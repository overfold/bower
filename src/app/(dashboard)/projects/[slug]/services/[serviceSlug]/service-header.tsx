import { getDeploymentsByService } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { ServiceActions } from './service-actions'
import { ServiceTabs } from './service-tabs'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { ResourceId } from '@/components/resource-id'
import { StatusDot } from '@/components/status'
import { LastDeployFailed } from '@/components/last-deploy-failed'

export async function ServiceHeader({
  slug,
  serviceSlug,
  serviceName,
  serviceId,
  environmentId,
  hasConfig,
  image,
  route,
  health, ready, replicas, canDeploy, failedDeploymentId,
}: {
  slug: string
  serviceSlug: string
  serviceName: string
  serviceId: string
  environmentId: string
  hasConfig: boolean
  image: string | null
  route: string | null
  health: string
  ready: number | null
  replicas: number
  canDeploy: boolean
  failedDeploymentId?: string
}) {
  const deployments = hasConfig ? await getDeploymentsByService(serviceId, 20) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3"><PageHeading as="h1" title={serviceName} /><StatusDot status={health} />{failedDeploymentId ? <LastDeployFailed href={`/projects/${slug}/deployments/${failedDeploymentId}`} /> : null}</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
              {image ? <span className="font-mono"><ResourceId value={image} copy /></span> : <span>Not deployed</span>}
              <span>{ready ?? 'Unknown'}/{replicas} ready</span>
              {route ? <Link className="inline-flex items-center gap-1 font-mono text-link" href={`https://${route}`} target="_blank" rel="noreferrer">{route}<ExternalLink className="h-3 w-3" /></Link> : null}
            </div>
          </div>
        </div>
        {hasConfig && canDeploy && <ServiceActions
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
