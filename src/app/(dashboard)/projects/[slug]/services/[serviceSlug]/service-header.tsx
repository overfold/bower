import { getDeploymentsByService } from '@/lib/queries'
import { PageHeading } from '@/components/page-heading'
import { ServiceActions } from './service-actions'
import { ServiceTabs } from './service-tabs'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { ResourceId } from '@/components/resource-id'
import { LastDeployFailed } from '@/components/last-deploy-failed'
import type { ServiceConfigDiff } from '@/lib/service-config-diff'
import { ServiceStatus } from './service-status'
import type { TrellisReplacementBackoff } from '@/types/trellis'
import { formatReadyReplicas } from '@/lib/format'
import { Chip } from '@/components/ui/badge'

export async function ServiceHeader({
  slug,
  serviceSlug,
  serviceName,
  serviceId,
  environmentId,
  hasConfig,
  image,
  route,
  health, ready, replicas, canDeploy, failedDeploymentId, failedDeploymentOutcome,
  changes, rollbackTargets, replacementBackoff, logsHref,
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
  failedDeploymentOutcome?: 'failed' | 'rolled_back'
  changes: ServiceConfigDiff[]
  rollbackTargets: { id: string; image: string; createdAt: string; changes: ServiceConfigDiff[] }[]
  replacementBackoff: TrellisReplacementBackoff | null
  logsHref?: string
}) {
  const deployments = hasConfig ? await getDeploymentsByService(serviceId, 20) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3"><PageHeading as="h1" title={serviceName} /><ServiceStatus health={health} ready={ready} replicas={replicas} serviceId={serviceId} environmentId={environmentId} logsHref={logsHref} replacementBackoff={replacementBackoff} canDeploy={canDeploy} />{changes.length ? <Chip tone="warn">Undeployed changes</Chip> : null}{failedDeploymentId ? <LastDeployFailed href={`/projects/${slug}/deployments/${failedDeploymentId}`} outcome={failedDeploymentOutcome} /> : null}</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
              {image ? <span className="font-mono"><ResourceId value={image} copy /></span> : <span>Not deployed</span>}
              <span>{formatReadyReplicas(ready, replicas)}</span>
              {route ? <Link className="inline-flex items-center gap-1 font-mono text-link" href={`https://${route}`} target="_blank" rel="noreferrer">{route}<ExternalLink className="h-3 w-3" /></Link> : null}
            </div>
          </div>
        </div>
        {hasConfig && canDeploy && <ServiceActions
          serviceId={serviceId}
          serviceName={serviceName}
          runningImage={image}
          environmentId={environmentId}
          hasDeployments={deployments.some((deployment) => deployment.environmentId === environmentId && Boolean(deployment.previousJobSpec))}
          changes={changes} rollbackTargets={rollbackTargets}
        />}
      </div>
      <div className="border-b border-line">
        <ServiceTabs slug={slug} serviceSlug={serviceSlug} />
      </div>
    </div>
  )
}
