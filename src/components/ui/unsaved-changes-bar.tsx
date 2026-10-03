'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

interface UnsavedChangesBarProps {
  dirty: boolean
  onDiscard: () => void
  onSave: () => void
  pending?: boolean
  saveLabel?: string
}

export function UnsavedChangesBar({ dirty, onDiscard, onSave, pending = false, saveLabel = 'Save changes' }: UnsavedChangesBarProps) {
  const [anchor, setAnchor] = useState<{ left: number; width: number } | null>(null)
  useEffect(() => {
    if (!dirty) return
    const main = document.getElementById('main-content')
    if (!main) return
    const update = () => {
      const rect = main.getBoundingClientRect()
      setAnchor({ left: rect.left + 16, width: rect.width - 32 })
    }
    update()
    main.dataset.unsaved = String(Number(main.dataset.unsaved || 0) + 1)
    const observer = new ResizeObserver(update)
    observer.observe(main)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      const remaining = Number(main.dataset.unsaved || 1) - 1
      if (remaining) main.dataset.unsaved = String(remaining)
      else delete main.dataset.unsaved
    }
  }, [dirty])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    const guardLink = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a[href]')
      if (link && !window.confirm('Discard your unsaved changes?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', guardLink, true)
    return () => {
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('click', guardLink, true)
    }
  }, [dirty])

  if (!dirty || !anchor) return null
  return createPortal(
    <div style={{ left: anchor.left, width: anchor.width }} className="fixed bottom-4 z-40 flex justify-center">
    <div role="status" className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-raised">
      <p className="text-sm font-medium text-ink">Unsaved changes</p>
      <div className="flex items-center gap-2">
        <Button type="button" onClick={onDiscard} disabled={pending}>Discard</Button>
        <Button type="button" variant="primary" onClick={onSave} loading={pending}>{saveLabel}</Button>
      </div>
    </div>
    </div>, document.body,
  )
}
