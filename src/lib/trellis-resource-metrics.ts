export interface NodeAllocatedResources {
  cpu: number
  memory: number
}

const CPU_METRIC = 'trellis_node_cpu_allocated_millicores'
const MEMORY_METRIC = 'trellis_node_memory_allocated_bytes'

export function parseNodeAllocatedResources(metrics: string): Map<string, NodeAllocatedResources> {
  const result = new Map<string, NodeAllocatedResources>()

  for (const rawLine of metrics.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const firstBrace = line.indexOf('{')
    const closeBrace = line.indexOf('}')
    if (firstBrace <= 0 || closeBrace <= firstBrace) continue

    const metric = line.slice(0, firstBrace)
    if (metric !== CPU_METRIC && metric !== MEMORY_METRIC) continue

    const labels = line.slice(firstBrace + 1, closeBrace)
    const nodeMatch = labels.match(/(?:^|,)node_id="((?:\\.|[^"])*)"(?:,|$)/)
    if (!nodeMatch) continue

    const valueText = line.slice(closeBrace + 1).trim().split(/\s+/)[0]
    const value = Number(valueText)
    if (!Number.isFinite(value)) continue

    const nodeId = nodeMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    const current = result.get(nodeId) ?? { cpu: 0, memory: 0 }
    if (metric === CPU_METRIC) current.cpu = value
    else current.memory = value
    result.set(nodeId, current)
  }

  return result
}
