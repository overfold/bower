import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(
  ({ className, type, mono, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-[border-color,box-shadow] duration-150 ease-enter placeholder:text-ink-muted focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 disabled:bg-sunken disabled:text-ink-muted file:border-0 file:bg-transparent file:text-sm file:font-medium",
          mono && "font-mono text-sm",
          props['aria-invalid'] === true && 'border-danger-500 focus:border-danger-500 focus:ring-danger-200',
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
