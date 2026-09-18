import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }>(
  ({ className, mono, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[60px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] leading-relaxed text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-enter placeholder:text-ink-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-sunken disabled:text-ink-muted',
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
