import http from 'node:http'
import https from 'node:https'

export async function loadCaddyConfig(address, config) {
  const url = new URL(address)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported Caddy admin protocol: ${url.protocol}`)
  }

  const body = Buffer.from(config)
  const transport = url.protocol === 'https:' ? https : http

  const response = await new Promise((resolve, reject) => {
    const request = transport.request(url, {
      method: 'POST',
      headers: {
        'content-type': 'text/caddyfile',
        'content-length': String(body.length),
      },
    }, (res) => {
      const chunks = []
      res.setEncoding('utf8')
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        body: chunks.join(''),
      }))
    })
    request.on('error', reject)
    request.end(body)
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Caddy reload returned ${response.status}: ${response.body}`)
  }
}
