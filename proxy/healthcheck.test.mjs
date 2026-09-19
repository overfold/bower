import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

const execFileAsync = promisify(execFile)
const script = new URL('./healthcheck.mjs', import.meta.url)

test('route-sync health check requires a recent successful reconciliation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bower-route-sync-'))
  const healthFile = join(dir, 'health')

  await assert.rejects(
    execFileAsync(process.execPath, [script.pathname], {
      env: { ...process.env, BOWER_SYNC_HEALTH_FILE: healthFile, BOWER_SYNC_HEALTH_MAX_AGE: '15' },
    }),
  )

  await writeFile(healthFile, `${Date.now()}\n`)
  await execFileAsync(process.execPath, [script.pathname], {
    env: { ...process.env, BOWER_SYNC_HEALTH_FILE: healthFile, BOWER_SYNC_HEALTH_MAX_AGE: '15' },
  })
})
