#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createClient, operations } from './client.mjs'

try {
  const call = createClient()
  serveStdio(() => {
    const server = new McpServer({ name: 'bower', version: '1.0.0' })
    for (const [operation, definition] of Object.entries(operations)) {
      if (definition.method && process.env.BOWER_ALLOW_WRITES !== '1') continue
      server.registerTool(`bower_${operation}`, {
        description: definition.description,
        inputSchema: definition.schema,
        annotations: { readOnlyHint: !definition.method, destructiveHint: !!definition.method, idempotentHint: !definition.method, openWorldHint: true },
      }, async (input) => {
        try {
          const result = await call(operation, input)
          return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result }
        } catch (error) {
          return { isError: true, content: [{ type: 'text', text: error.message }] }
        }
      })
    }
    return server
  })
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
