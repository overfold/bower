'use client'

import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/components/ui/feedback'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function OneTimeSecret({ label, value, description }: { label: string; value: string; description?: ReactNode }) {
  const id = useId()
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
      {description ? <div className="text-sm text-ink-soft">{description}</div> : null}
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Textarea id={id} readOnly value={value} mono rows={1} className="min-w-0 flex-1 resize-none overflow-hidden break-all bg-sunken [field-sizing:content]" />
        <Button type="button" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`} className="w-full sm:w-auto">
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
