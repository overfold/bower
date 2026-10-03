import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { auditActionSentence } from './labels'

test('every emitted literal audit action has an explicit sentence', () => {
  const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [join(directory, entry.name)] : [])
  const files = sourceFiles('src').filter((file) => !file.endsWith('.test.ts'))
  const emitted = new Set<string>(['project.update', 'secret.rotate', 'service.deploy', 'deployment.reconciled'])
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

test('unknown actions retain the actual action and resource', () => {
  assert.equal(auditActionSentence('custom.sync_requested', 'billing'), 'performed custom.sync_requested on billing')
})

test('common audit actions have specific sentences and deployment tags', () => {
  assert.equal(auditActionSentence('project.update', 'Commerce Platform'), 'updated Commerce Platform')
  assert.equal(auditActionSentence('secret.rotate', 'DATABASE_URL'), 'rotated secret DATABASE_URL')
  assert.equal(auditActionSentence('service.deploy', 'Storefront', { image: 'ghcr.io/acme/storefront:v2.4.1' }), 'deployed Storefront v2.4.1')
  assert.equal(auditActionSentence('deployment.reconciled', 'Storefront'), 'reconciled Storefront')
})
