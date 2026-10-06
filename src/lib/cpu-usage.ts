import type { TrellisAllocationMetrics } from '@/types/trellis'

/** After this many samples without a usable CPU reading, stop showing a skeleton and say so. */
export const CPU_SAMPLE_ATTEMPTS = 3

/**
 * CPU millicores between two metrics samples. Trellis reports a cumulative counter, so a reading needs
 * two samples with advancing `collected_at`. A counter that went backwards was reset (a crash-looping
 * task restarted), so the new value is the usage since that reset. Returns null with no usable pair.
 */
export function cpuMillicores(previous: TrellisAllocationMetrics[], next: TrellisAllocationMetrics[]): number | null {
  const previousByTask = new Map(previous.map((item) => [`${item.allocation_id}/${item.task}`, item]))
  let total = 0
  let samples = 0
  for (const item of next) {
    const before = previousByTask.get(`${item.allocation_id}/${item.task}`)
    if (!before) continue
    const elapsedMs = Date.parse(item.collected_at) - Date.parse(before.collected_at)
    if (!(elapsedMs > 0)) continue
    const delta = item.cpu_usage_nanoseconds - before.cpu_usage_nanoseconds
    const usedNs = delta >= 0 ? delta : item.cpu_usage_nanoseconds
    total += (usedNs / (elapsedMs * 1_000_000)) * 1000
    samples += 1
  }
  return samples > 0 ? total : null
}
