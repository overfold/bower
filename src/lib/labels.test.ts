import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { auditActionSentence } from './labels'

test('every emitted literal audit action has an explicit sentence', () => {
  const files = [
    'src/app/api/exec/context/route.ts',
    ...['allocation-actions', 'base-service-config', 'domains', 'environment-variables', 'integrations', 'operations', 'project-volumes', 'projects', 'routes', 'service-settings', 'services', 'settings']
      .map((name) => `src/lib/actions/${name}.ts`),
    'src/lib/invitations.ts',
  ]
  const emitted = new Set<string>()
  for (const file of files) {
    const source = readFileSync(join(process.cwd(), file), 'utf8')
    for (const call of source.matchAll(/recordAudit\(\{[\s\S]*?\}\)/g)) {
      const actionExpression = call[0].match(/action:\s*([\s\S]*?),\s*resourceType:/)?.[1] ?? ''
      for (const literal of actionExpression.matchAll(/['"]([a-z][a-z0-9_.]+)['"]/g)) emitted.add(literal[1])
    }
  }

  const labelsSource = readFileSync(join(process.cwd(), 'src/lib/labels.ts'), 'utf8')
  for (const action of emitted) {
    assert.match(labelsSource, new RegExp(`['"]${action.replaceAll('.', '\\.') }['"]\\s*:`), action)
  }
})

test('unknown audit actions are humanized rather than described as an update', () => {
  assert.equal(auditActionSentence('custom.sync_requested', 'billing'), 'Custom sync requested · billing')
})
