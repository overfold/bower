'use client'

import { StatusDot } from '@/components/status'
import type { TrellisReplacementBackoff } from '@/types/trellis'

export function ServiceStatus({ health }: { health: string; ready: number | null; replicas: number; serviceId: string; environmentId: string; logsHref?: string; replacementBackoff: TrellisReplacementBackoff | null; canDeploy?: boolean }) {
  return <StatusDot status={health} />
}
