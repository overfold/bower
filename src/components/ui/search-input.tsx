import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

const SearchInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  ({ className, ...props }, ref) => (
    <span className="relative block min-w-[240px] flex-1">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-ink-faint" />
      <Input ref={ref} type="search" className={cn('pl-8', className)} {...props} />
    </span>
  ),
)
SearchInput.displayName = 'SearchInput'

export { SearchInput }
