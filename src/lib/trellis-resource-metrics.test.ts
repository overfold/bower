import assert from 'node:assert/strict'
import test from 'node:test'
import { parseNodeAllocatedResources } from './trellis-resource-metrics'

test('parses allocated CPU and memory by node', () => {
  const parsed = parseNodeAllocatedResources(`# HELP trellis_node_cpu_allocated_millicores CPU reserved
# TYPE trellis_node_cpu_allocated_millicores gauge
trellis_node_cpu_allocated_millicores{node_id="node-a"} 750
trellis_node_memory_allocated_bytes{node_id="node-a"} 536870912
trellis_node_cpu_allocated_millicores{node_id="node-b"} 1250
trellis_node_memory_allocated_bytes{node_id="node-b"} 1073741824
`)

  assert.deepEqual(parsed.get('node-a'), { cpu: 750, memory: 536870912 })
  assert.deepEqual(parsed.get('node-b'), { cpu: 1250, memory: 1073741824 })
})

test('ignores unrelated and malformed metrics', () => {
  const parsed = parseNodeAllocatedResources(`trellis_nodes{status="healthy"} 2
trellis_node_cpu_allocated_millicores{node_id="node-a"} not-a-number
malformed
`)

  assert.equal(parsed.size, 0)
})
