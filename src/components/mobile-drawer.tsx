'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Menu, X } from 'lucide-react'
import { SidebarContent } from '@/components/sidebar'

const subscribeToHydration = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

interface MobileDrawerProps {
  user: {
    name: string
    email: string
    avatarUrl: string | null
  }
}

function DrawerInner({ user }: MobileDrawerProps) {
  const [open, setOpen] = useState(false)
  const mounted = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot)
  const reduced = useReducedMotion()
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open])

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-black/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-ink/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={close}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 w-[min(84vw,300px)] overflow-y-auto border-r border-line bg-surface shadow-pop scroll-thin"
              initial={reduced ? { opacity: 0 } : { x: '-100%' }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: '-100%' }}
              transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="absolute right-2 top-3 z-10">
                <button
                  type="button"
                  aria-label="Close navigation"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-black/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                  onClick={close}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent user={user} onNavigate={close} />
            </motion.div>
          </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export function MobileDrawer({ user }: MobileDrawerProps) {
  const pathname = usePathname()
  return <DrawerInner key={pathname} user={user} />
}
