import { MoreHorizontal } from 'lucide-react'
import { IconButton } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function RowActions({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={`Actions for ${name}`}><MoreHorizontal /></IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

export {
  DropdownMenuItem as RowActionItem,
  DropdownMenuSeparator as RowActionSeparator,
} from '@/components/ui/dropdown-menu'
