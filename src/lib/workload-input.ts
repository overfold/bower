import { posix } from 'node:path'
import type { BowerSecretBinding } from './job-builder'

export type VolumeMount = { name: string; container_path: string; read_only?: boolean }

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

function exactShape(row: Record<string, unknown>, allowed: string[], label: string) {
  const extra = Object.keys(row).find((key) => !allowed.includes(key))
  if (extra) throw new Error(`${label} contains unsupported field ${extra}.`)
}

export function parseJsonInput(formData: FormData, key: string, fallback: unknown): unknown {
  const raw = String(formData.get(key) ?? '').trim()
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new Error(`${key} must contain valid JSON.`)
  }
}

export function validateVolumeMounts(input: unknown): VolumeMount[] {
  if (!Array.isArray(input)) throw new Error('Volume mounts must be a list.')
  if (input.length > 32) throw new Error('A service may attach at most 32 volumes.')

  const names = new Set<string>()
  const paths = new Set<string>()
  return input.map((value, index) => {
    const label = `Volume mount ${index + 1}`
    const row = object(value, label)
    exactShape(row, ['name', 'container_path', 'read_only'], label)
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const containerPath = typeof row.container_path === 'string' ? row.container_path.trim() : ''

    if (!IDENTIFIER.test(name)) throw new Error(`${label} needs a valid Trellis identifier.`)
    if (names.has(name)) throw new Error(`Volume name ${name} is duplicated.`)
    names.add(name)
    if (!posix.isAbsolute(containerPath) || posix.normalize(containerPath) !== containerPath) {
      throw new Error(`Mount path for ${name} must be a clean absolute path.`)
    }
    if (containerPath === '/' || containerPath === '/run'
      || containerPath === '/run/trellis' || containerPath.startsWith('/run/trellis/')
      || containerPath === '/run/trellis-secrets' || containerPath.startsWith('/run/trellis-secrets/')) {
      throw new Error(`Mount path for ${name} must not use the reserved /run/trellis or /run/trellis-secrets paths.`)
    }
    if (paths.has(containerPath)) throw new Error(`Mount path ${containerPath} is duplicated.`)
    paths.add(containerPath)
    if (row.read_only !== undefined && typeof row.read_only !== 'boolean') {
      throw new Error(`${label} read_only must be a boolean.`)
    }

    return { name, container_path: containerPath, ...(row.read_only === true ? { read_only: true } : {}) }
  })
}

export function validateSecretBindings(input: unknown): BowerSecretBinding[] {
  if (!Array.isArray(input)) throw new Error('Secret bindings must be a list.')
  if (input.length > 64) throw new Error('A service may define at most 64 secret bindings.')

  const names = new Set<string>()
  const destinations = new Set<string>()
  return input.map((value, index) => {
    const label = `Secret binding ${index + 1}`
    const row = object(value, label)
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!IDENTIFIER.test(name)) throw new Error(`${label} needs a valid Trellis secret identifier.`)
    if (names.has(name)) throw new Error(`Secret ${name} is bound more than once.`)
    names.add(name)

    if (row.target === 'env') {
      exactShape(row, ['name', 'target', 'env'], label)
      const env = typeof row.env === 'string' ? row.env.trim() : ''
      // Bower intentionally keeps its shell-style environment-name convention.
      if (!ENV_NAME.test(env)) throw new Error(`Secret ${name} needs a valid environment variable target.`)
      const destination = `env:${env}`
      if (destinations.has(destination)) throw new Error(`Environment target ${env} is used more than once.`)
      destinations.add(destination)
      return { name, target: 'env', env }
    }

    if (row.target === 'file') {
      exactShape(row, ['name', 'target', 'path'], label)
      const path = typeof row.path === 'string' ? row.path.trim() : ''
      if (!path.startsWith('/run/trellis-secrets/') || posix.normalize(path) !== path) {
        throw new Error(`Secret ${name} file targets must be clean paths below /run/trellis-secrets/.`)
      }
      const destination = `file:${path}`
      if (destinations.has(destination)) throw new Error(`File target ${path} is used more than once.`)
      destinations.add(destination)
      return { name, target: 'file', path }
    }

    throw new Error(`${label} target must be env or file.`)
  })
}

export function validateCanarySteps(input: unknown): number[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Canary steps must be a non-empty list.')
  if (input.length > 100) throw new Error('Canary steps may contain at most 100 entries.')
  let previous = 0
  const steps = input.map((value, index) => {
    if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
      throw new Error(`Canary step ${index + 1} must be an integer between 1 and 100.`)
    }
    if (value <= previous) throw new Error('Canary steps must be strictly increasing without duplicates.')
    previous = value
    return value
  })
  if (steps.at(-1) !== 100) throw new Error('Canary steps must end at 100.')
  return steps
}

export function validateHostPath(path: string) {
  if (path.startsWith('@/')) {
    const relative = path.slice(2)
    if (!relative || posix.isAbsolute(relative) || posix.normalize(relative) !== relative || relative === '.' || relative === '..' || relative.startsWith('../')) {
      throw new Error('Managed paths must contain a clean relative path below @/.')
    }
    return
  }
  if (!posix.isAbsolute(path) || posix.normalize(path) !== path) throw new Error('Host paths must be clean absolute paths.')
}
