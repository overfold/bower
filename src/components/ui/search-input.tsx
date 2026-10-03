'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

const SearchInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  ({ className, onChange, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => inputRef.current!)
    const [value, setValue] = React.useState(props.defaultValue ?? '')
    const hasValue = String(props.value ?? value).length > 0
    return <span className="relative block min-w-[240px] flex-1">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-ink-faint" />
      <Input ref={inputRef} type="search" placeholder="Search" className={cn('pl-8 pr-9', className)} {...props} onChange={(event) => { setValue(event.target.value); onChange?.(event) }} />
      {hasValue ? <button type="button" aria-label="Clear search" disabled={props.disabled} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-ink-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed" onClick={() => {
        const input = inputRef.current!
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        setter.call(input, '')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        setValue('')
        input.focus()
      }}><X className="size-3.5" aria-hidden /></button> : null}
    </span>
  },
)
SearchInput.displayName = 'SearchInput'

export { SearchInput }
