export type DateValue = Date | string | null | undefined

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

function validDate(value: DateValue): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function formatDate(value: DateValue): string {
  const date = validDate(value)
  return date ? `${dateFormatter.format(date)} UTC` : '—'
}

export function formatTimestamp(value: DateValue): string {
  const date = validDate(value)
  return date ? `${timestampFormatter.format(date)} UTC` : '—'
}

export function formatRelativeTime(value: DateValue, now = Date.now()): string {
  const date = validDate(value)
  if (!date || !Number.isFinite(now)) return '—'
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
  return `${Number(cores.toFixed(3))} ${cores === 1 ? 'core' : 'cores'}`
}

export function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${Number((mb / 1024).toFixed(1))} GB` : `${Number(mb.toFixed(1))} MB`
}
