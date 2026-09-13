import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('h-6 w-6', className)}
    >
      <defs>
        <clipPath id="bower-ac">
          <path d="M7.3 19V12.1a4.7 4.7 0 0 1 9.4 0V19Z" />
        </clipPath>
      </defs>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="var(--brand-500, #0C7065)" />
      <g clipPath="url(#bower-ac)" stroke="white" strokeWidth="0.4">
        <line x1="7.5" y1="0" x2="24" y2="16.5" />
        <line x1="5" y1="0" x2="24" y2="19" />
        <line x1="2.5" y1="0" x2="24" y2="21.5" />
        <line x1="0" y1="0" x2="24" y2="24" />
        <line x1="0" y1="2.5" x2="21.5" y2="24" />
        <line x1="0" y1="5" x2="19" y2="24" />
        <line x1="0" y1="7.5" x2="16.5" y2="24" />
        <line x1="0" y1="10" x2="14" y2="24" />
        <line x1="0" y1="14" x2="14" y2="0" />
        <line x1="0" y1="16.5" x2="16.5" y2="0" />
        <line x1="0" y1="19" x2="19" y2="0" />
        <line x1="0" y1="21.5" x2="21.5" y2="0" />
        <line x1="0" y1="24" x2="24" y2="0" />
        <line x1="2.5" y1="24" x2="24" y2="2.5" />
        <line x1="5" y1="24" x2="24" y2="5" />
        <line x1="7.5" y1="24" x2="24" y2="7.5" />
        <line x1="10" y1="24" x2="24" y2="10" />
      </g>
      <path
        d="M6.5 19V12a5.5 5.5 0 0 1 11 0v7"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Wordmark({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={markClassName} />
      <span className="text-[17px] font-bold tracking-tightest text-ink">bower</span>
    </span>
  )
}

export function Brand({ className, size = 'default' }: { className?: string; size?: 'sm' | 'default' | 'lg' }) {
  const markSize = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
  const textSize = size === 'sm' ? 'text-[17px]' : size === 'lg' ? 'text-2xl' : 'text-lg'

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={markSize} />
      <span className={cn('font-bold tracking-tightest text-ink', textSize)}>bower</span>
    </span>
  )
}
