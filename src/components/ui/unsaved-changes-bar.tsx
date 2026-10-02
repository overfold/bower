'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface UnsavedChangesBarProps {
  dirty: boolean
  onDiscard: () => void
  onSave: () => void
  pending?: boolean
  saveLabel?: string
}

export function UnsavedChangesBar({ dirty, onDiscard, onSave, pending = false, saveLabel = 'Save changes' }: UnsavedChangesBarProps) {
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

  if (!dirty) return null
  return (
    <>
    <div aria-hidden className="h-24" />
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-raised">
      <p className="text-sm font-medium text-ink">Unsaved changes</p>
      <div className="flex items-center gap-2">
        <Button type="button" onClick={onDiscard} disabled={pending}>Discard</Button>
        <Button type="button" variant="primary" onClick={onSave} loading={pending}>{saveLabel}</Button>
      </div>
    </div>
    </>
  )
}
