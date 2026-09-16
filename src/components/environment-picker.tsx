'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Layers } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Environment {
  id: string
  name: string
}

export function EnvironmentPicker({ environments }: { environments: Environment[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('env') ?? 'base'

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'base') {
      params.delete('env')
    } else {
      params.set('env', value)
    }
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="h-8 gap-1.5 py-0 text-[12.5px] w-40">
        <Layers className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="base">Base</SelectItem>
        {environments.map((env) => (
          <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
