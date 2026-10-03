'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'

export function OneTimeSecret({ label, value }: { label: string; value: string }) {
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
      <InlineNotice tone="warning">You won’t see this again.</InlineNotice>
      <div className="flex items-center gap-2">
        <Input aria-label={label} readOnly value={value} mono className="min-w-0 flex-1 bg-sunken" />
        <Button type="button" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
