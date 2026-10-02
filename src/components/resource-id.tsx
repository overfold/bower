'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { IconButton } from '@/components/ui/button'

export function resourceLabel(value: string, name?: string | null): string {
  if (name) return name
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) || /^[0-9a-f]{20,}$/i.test(value)
    ? `${value.slice(0, 6)}…${value.slice(-4)}` : value
}

export function ResourceId({ value, name, copy = false, className = '' }: { value: string; name?: string | null; copy?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  return <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
    <span title={value} className="truncate font-mono">{resourceLabel(value, name)}</span>
    {copy ? <IconButton label={copied ? 'Copied' : 'Copy full ID'} onClick={async () => {
      try { await navigator.clipboard.writeText(value); setCopied(true); setError(false); setTimeout(() => setCopied(false), 2000) }
      catch { setError(true) }
    }}>{copied ? <Check /> : <Copy />}</IconButton> : null}
    {error ? <span role="alert" className="text-xs text-danger-500">Copy failed</span> : null}
  </span>
}
