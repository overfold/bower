export type DateValue = Date | string | null | undefined

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const timestampOptions: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
}

function validDate(value: DateValue): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function formatDate(value: DateValue): string {
  const date = validDate(value)
  return date ? `${dateFormatter.format(date)} UTC` : '—'
}

export function formatTimestamp(value: DateValue, timeZone?: string): string {
  const date = validDate(value)
  return date ? new Intl.DateTimeFormat('en-US', { ...timestampOptions, timeZone }).format(date) : '—'
}

export function timestampTitle(value: DateValue, timeZone?: string): string {
  const local = formatTimestamp(value, timeZone)
  const utc = formatTimestamp(value, 'UTC')
  return local === utc ? utc : `${local} · ${utc}`
}

export function formatRelativeTime(value: DateValue, now = Date.now()): string {
  const date = validDate(value)
  if (!date || !Number.isFinite(now)) return '—'
  const futureSeconds = Math.ceil((date.getTime() - now) / 1000)
  if (futureSeconds > 0) {
    if (futureSeconds < 60) return `in ${futureSeconds} ${futureSeconds === 1 ? 'second' : 'seconds'}`
    const minutes = Math.ceil(futureSeconds / 60)
    if (futureSeconds < 3600) return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
    const hours = Math.ceil(futureSeconds / 3600)
    if (futureSeconds < 86400) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`
    const days = Math.ceil(futureSeconds / 86400)
    return `in ${days} ${days === 1 ? 'day' : 'days'}`
  }
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function formatDisplayToken(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatCpu(millicores: number): string {
  const cores = millicores / 1000
  if (cores > 0 && cores < 0.01) return '<0.01 cores'
  const rounded = Number(cores.toFixed(2))
  return `${rounded} ${rounded === 1 ? 'core' : 'cores'}`
}

export function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${Number((mb / 1024).toFixed(1))} GB` : `${Number(mb.toFixed(1))} MB`
}

export function formatReadyReplicas(ready: number | null | undefined, desired: number): string {
  return ready == null ? `Unavailable · ${desired} desired` : formatRatio(ready, desired, 'ready')
}

export function formatRatio(value: number, total: number, noun: string): string {
  return `${value}/${total} ${noun}`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function deploymentImageTag(image: string): string {
  if (image.includes('@')) return image.slice(image.lastIndexOf('@') + 1)
  const name = image.split('/').at(-1) ?? image
  return name.includes(':') ? name.slice(name.lastIndexOf(':') + 1) : 'latest'
}

export function shortDeploymentImage(image?: string | null) {
  return image ? image.split('/').at(-1) ?? image : '—'
}

export function formatDeploymentDuration(startedAt?: Date, completedAt?: Date | null) {
  if (!startedAt || !completedAt) return '—'
  const seconds = Math.max(0, Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
