import * as React from 'react'
export { InlineNotice } from '@/components/ui/feedback'

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-sunken text-ink-muted">
        {icon}
      </div>
      <p className="mt-4 text-[14px] font-semibold tracking-tight text-ink">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
