import { deploymentImageTag } from '@/lib/format'
import type { MetricsDeployment } from '@/lib/metrics-series'
import { statusDefinition } from '@/lib/status'
import type { TimeSeriesMarker } from '@/lib/time-series'

// Kept apart from metrics-series, which reaches server-only modules through the sampler: client components import this.

/** Marker label and tone come from the shared status vocabulary, so a failed rollout reads and colors like it does everywhere else. */
export function deploymentMarkers(deployments: MetricsDeployment[]): Required<TimeSeriesMarker>[] {
  return deployments.map((deployment) => {
    const status = statusDefinition(deployment.status)
    const tag = deploymentImageTag(deployment.image)
    return { t: deployment.startedAt, label: status ? `Deployed ${tag} (${status.label})` : `Deployed ${tag}`, tone: status?.tone ?? 'neutral' }
  })
}
