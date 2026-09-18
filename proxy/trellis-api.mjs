import http from 'node:http'
import https from 'node:https'

export function normalizeTrellisAddress(address) {
  const value = String(address || '').trim().replace(/\/+$/, '')
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

export function buildTrellisRequest(address, path, { token, namespace, caCert = '' }) {
  const base = normalizeTrellisAddress(address)
  if (!base) throw new Error('TRELLIS_ADDR is required.')

  const url = new URL(path, `${base}/`)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported Trellis API protocol: ${url.protocol}`)
  }

  const options = {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'x-trellis-namespace': namespace,
      accept: 'application/json',
    },
  }

  if (url.protocol === 'https:' && caCert.trim()) options.ca = caCert
  return { url, options }
}

export async function fetchTrellisJson(address, path, credentials) {
  const { url, options } = buildTrellisRequest(address, path, credentials)
  const transport = url.protocol === 'https:' ? https : http

  return await new Promise((resolve, reject) => {
    const request = transport.request(url, options, (response) => {
      const chunks = []
      response.setEncoding('utf8')
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        const body = chunks.join('')
        const status = response.statusCode || 0
        if (status < 200 || status >= 300) {
          reject(new Error(`Trellis returned ${status}${body ? `: ${body}` : ''}`))
          return
        }
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(new Error(`Trellis returned invalid JSON: ${error.message}`))
        }
      })
    })
    request.on('error', reject)
    request.end()
  })
}
