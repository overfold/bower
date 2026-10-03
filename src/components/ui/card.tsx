import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('min-w-0 overflow-hidden rounded-xl border border-line bg-surface', className)} {...props} />
  ),
)
Card.displayName = 'Card'

interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  hint?: React.ReactNode
  action?: React.ReactNode
  as?: 'h1' | 'h2' | 'h3'
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, hint, action, as: Heading = 'h2', children, ...props }, ref) => (
    <div ref={ref} className={cn('flex min-h-[52px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3', title !== undefined && 'flex-col items-stretch sm:flex-row sm:items-center', className)} {...props}>
      {title !== undefined ? <>
        <div className="min-w-0 flex-1">
          <Heading className="break-words text-sm font-semibold tracking-tight text-ink">{title}</Heading>
          {hint ? <p className="mt-0.5 break-words text-xs text-ink-muted">{hint}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{action}</div> : null}
      </> : children}
    </div>
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h1' | 'h2' | 'h3' }>(
  ({ className, as: Heading = 'h2', ...props }, ref) => (
    <Heading ref={ref} className={cn('min-w-0 break-words text-sm font-semibold tracking-tight text-ink', className)} {...props} />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('order-last basis-full text-xs text-ink-muted', className)} {...props} />
  ),
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-line bg-sunken px-4 py-3', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
