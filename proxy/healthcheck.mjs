import { stat } from 'node:fs/promises'
import process from 'node:process'

const healthFile = process.env.BOWER_SYNC_HEALTH_FILE || '/tmp/bower-route-sync-health'
const maxAge = Math.max(1, Number(process.env.BOWER_SYNC_HEALTH_MAX_AGE || 15)) * 1000

try {
  const info = await stat(healthFile)
  if (Date.now() - info.mtimeMs <= maxAge) process.exit(0)
} catch {
  // Missing state means route-sync has not completed successfully yet.
}

console.error('route-sync has not completed a successful Caddy reconciliation recently')
process.exit(1)
