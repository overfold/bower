import type { TrellisAllocation } from '@/types/trellis'

export function assertExecAllocation(
  allocations: TrellisAllocation[], id: string, namespace: string, service: string, activeJob: string | null,
) {
  // Namespace is a security boundary even if Trellis returns a cluster-wide list.
  const allocation = allocations.find((item) => item.id === id && item.namespace === namespace
    && (item.labels?.['bower/service'] === service || item.job === service || item.job === activeJob))
  if (!allocation) throw new Error('Allocation does not belong to this service environment.')
}
