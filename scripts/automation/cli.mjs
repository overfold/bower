#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { createClient, operations } from './client.mjs'

const help = `Bower application automation (Node.js 22)
Usage: npm run --silent bower -- <operation> [options]
Operations: ${Object.keys(operations).join(', ')}
Options: --project-id UUID, --service-id UUID, --environment-id UUID,
         --allocation-id ID, --task NAME, --image IMAGE,
         --target-deployment-id UUID, --confirm
Set BOWER_URL and BOWER_TOKEN in the environment; never pass tokens as arguments.
Writes require --confirm and their own key scope. Output is JSON; errors go to stderr.
Use the API documentation in docs/automation.md for limits and accepted-state semantics.`

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean', short: 'h' }, confirm: { type: 'boolean' },
    ...Object.fromEntries(['project-id', 'service-id', 'environment-id', 'allocation-id', 'task', 'image', 'target-deployment-id'].map(name => [name, { type: 'string' }])),
  } })
  if (values.help) console.log(help)
  else {
    if (positionals.length !== 1 || !Object.hasOwn(operations, positionals[0])) throw new Error(help)
    const args = Object.fromEntries(Object.entries(values).map(([name, value]) => [name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]))
    const result = await createClient()(positionals[0], args)
    console.log(JSON.stringify(result, null, 2))
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
