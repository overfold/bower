import process from 'node:process'
import { renderCaddyfile } from './config.mjs'
import { fetchTrellisJson, normalizeTrellisAddress } from './trellis-api.mjs'

const routes = JSON.parse(process.env.BOWER_ROUTES || '[]')
const trellis = normalizeTrellisAddress(process.env.TRELLIS_ADDR || '')
const token = process.env.TRELLIS_TOKEN || ''
const namespace = process.env.TRELLIS_NAMESPACE || ''
const caCert = process.env.TRELLIS_CA_CERT || ''
const caddy = process.env.CADDY_ADMIN_URL || 'http://127.0.0.1:2019/load'
const adminPort = process.env.CADDY_ADMIN_PORT || '2019'
const httpPort = process.env.CADDY_HTTP_PORT || '80'
const httpsPort = process.env.CADDY_HTTPS_PORT || '443'
const interval = Math.max(1, Number(process.env.BOWER_SYNC_INTERVAL || 5)) * 1000
if (!trellis || !token || !namespace) throw new Error('Trellis api_access variables are required.')

console.log(`using Trellis API ${new URL(trellis).origin}`)

let last = ''

async function reconcile() {
  const allocations = await fetchTrellisJson(trellis, '/v1/allocations', { token, namespace, caCert })
  const config = renderCaddyfile(routes, allocations, { adminPort, httpPort, httpsPort })
  if (config === last) return
  const loaded = await fetch(caddy, { method: 'POST', headers: { 'content-type': 'text/caddyfile' }, body: config })
  if (!loaded.ok) throw new Error(`Caddy reload returned ${loaded.status}: ${await loaded.text()}`)
  last = config
  console.log(`loaded ${routes.length} routes with ${allocations.length} allocations`)
}

for (;;) {
  try { await reconcile() } catch (error) { console.error(error) }
  await new Promise((resolve) => setTimeout(resolve, interval))
}
