'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Textarea } from '@/components/ui/textarea'

export function OneTimeSecret({ label, value, description }: { label: string; value: string; description?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const { toast } = useFeedback()

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      toast({ title: `${label} copied.`, tone: 'success' })
    } catch {
      toast({ title: `Could not copy ${label.toLowerCase()}.`, tone: 'error' })
    }
  }

  return (
    <div className="space-y-3">
      <InlineNotice tone="warning">{label === 'Invitation link' ? 'You won’t see this link again.' : 'You won’t see this again.'}</InlineNotice>
      {description ? <div className="text-sm text-ink-soft">{description}</div> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Textarea aria-label={label} readOnly value={value} mono rows={1} className="min-w-0 flex-1 resize-none overflow-hidden break-all bg-sunken [field-sizing:content]" />
        <Button type="button" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`} className="w-full sm:w-auto">
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
