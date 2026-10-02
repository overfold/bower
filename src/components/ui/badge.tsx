import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { toneClasses, type Tone } from '@/lib/tone'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-2xs font-medium',
  {
    variants: {
      variant: {
        default: toneClasses.neutral,
        secondary: 'bg-sunken text-ink-soft border-line',
        danger: 'bg-danger-50 text-danger-500 border-danger-200',
        outline: 'bg-surface text-ink-soft border-line',
        success: toneClasses.success,
        warning: 'bg-warn-50 text-warn-500 border-warn-200',
        info: 'bg-info-50 text-info-500 border-info-200',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { tone?: Tone }

function Badge({ className, variant, tone, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), tone && toneClasses[tone], className)} {...props} />
}

export { Badge, badgeVariants }
