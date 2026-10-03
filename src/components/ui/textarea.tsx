import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }>(
  ({ className, mono, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed text-ink transition-[border-color,box-shadow] duration-150 ease-enter placeholder:text-ink-muted focus-visible:border-brand-300 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-100 disabled:bg-sunken disabled:text-ink-muted aria-[invalid=true]:border-danger-500 aria-[invalid=true]:focus-visible:border-danger-500 aria-[invalid=true]:focus-visible:ring-danger-200",
          mono && 'font-mono',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }
