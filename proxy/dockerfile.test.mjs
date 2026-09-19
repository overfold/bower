import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('route-sync image includes its runtime modules', async () => {
  const dockerfile = await readFile(new URL('./Dockerfile.agent', import.meta.url), 'utf8')
  assert.match(dockerfile, /COPY\s+agent\.mjs\s+config\.mjs\s+trellis-api\.mjs\s+healthcheck\.mjs\s+\/app\//)
})
