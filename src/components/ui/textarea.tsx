import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }>(
  ({ className, mono, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-ink transition-[border-color,box-shadow] duration-150 ease-enter placeholder:text-ink-muted focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 disabled:bg-sunken disabled:text-ink-muted",
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
