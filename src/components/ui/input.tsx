import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(
  ({ className, type, mono, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-[border-color,box-shadow] duration-150 ease-enter placeholder:text-ink-muted focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-100 disabled:border-line disabled:bg-sunken disabled:text-ink-muted disabled:placeholder:text-ink-muted file:border-0 file:bg-transparent file:text-sm file:font-medium aria-[invalid=true]:border-danger-500 aria-[invalid=true]:ring-danger-200 aria-[invalid=true]:focus-visible:border-danger-500 aria-[invalid=true]:focus-visible:ring-danger-200",
          mono && "font-mono text-code",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
