'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import { SidebarContent } from '@/components/sidebar'

interface MobileDrawerProps {
  user: {
    name: string
    email: string
    avatarUrl: string | null
  }
  projects: { id: string; name: string; slug: string }[]
  currentOrg: { id: string; name: string; slug: string; role: string }
}

function DrawerInner({ user, projects, currentOrg }: MobileDrawerProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        type="button"
        aria-label="Open navigation"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 w-[min(84vw,300px)] overflow-y-auto border-r border-line bg-surface shadow-pop scroll-thin">
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <DialogPrimitive.Close aria-label="Close navigation" className="absolute right-2 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
          <SidebarContent
            user={user}
            projects={projects}
            currentOrg={currentOrg}
            onNavigate={() => setOpen(false)}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function MobileDrawer(props: MobileDrawerProps) {
  const pathname = usePathname()
  return <DrawerInner key={pathname} {...props} />
}
