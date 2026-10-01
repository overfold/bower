import http from 'node:http'
import https from 'node:https'

export function openExec(connection, signal) {
  return new Promise((resolve, reject) => {
    const url = new URL(connection.url)
    // Plaintext is only useful for isolated local fixtures. Never send a
    // workload credential to a remote HTTP listener.
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
      reject(new Error('Exec requires HTTPS'))
      return
    }
    const transport = url.protocol === 'https:' ? https : http
    const req = transport.request(url, {
      method: 'GET', headers: connection.headers, signal,
      rejectUnauthorized: true,
      ...(connection.ca ? { ca: connection.ca } : {}),
    })
    const timeout = setTimeout(() => req.destroy(new Error('Exec handshake timed out')), 10000)
    const finish = () => clearTimeout(timeout)
    req.on('error', (error) => { finish(); reject(error) })
    req.on('response', (res) => {
      finish()
      res.destroy()
      reject(new Error(`Trellis refused exec (HTTP ${res.statusCode})`))
    })
    req.on('upgrade', (res, socket, head) => {
      finish()
      if (res.statusCode !== 101 || res.headers.upgrade?.toLowerCase() !== 'trellis-exec.v1') {
        socket.destroy()
        reject(new Error('Invalid Trellis exec upgrade'))
        return
      }
      socket.pause()
      if (head.length) socket.unshift(head)
      resolve(socket)
    })
    req.end()
  })
}
