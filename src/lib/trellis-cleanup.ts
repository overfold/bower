import { TrellisApiError } from '@/lib/trellis'

/** Absent resources are already cleaned up; all other failures must block DB deletion. */
export async function cleanupTrellisResources(requests: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(requests)
  const failed = results.find((result) => result.status === 'rejected'
    && !(result.reason instanceof TrellisApiError && result.reason.status === 404))
  if (failed?.status === 'rejected') throw failed.reason
}
