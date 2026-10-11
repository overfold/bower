'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

interface UnsavedChangesBarProps {
  dirty: boolean
  onDiscard: () => void
  onSave: () => void
  onSaveAndDeploy?: () => void
  pending?: boolean
  saveLabel?: string
  count?: number
  summary?: string
}

export function UnsavedChangesBar({ dirty, onDiscard, onSave, onSaveAndDeploy, pending = false, saveLabel = 'Save changes', count, summary }: UnsavedChangesBarProps) {
  const [anchor, setAnchor] = useState<{ left: number; width: number } | null>(null)
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const main = document.getElementById('main-content')
    const element = bar.current
    if (!dirty || !main || !element) return
    const update = () => main.style.setProperty('--unsaved-bar-height', `${element.getBoundingClientRect().height}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => { observer.disconnect(); main.style.removeProperty('--unsaved-bar-height') }
  }, [dirty, anchor])
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
    <div ref={bar} role="status" className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-raised">
      <p className="text-sm font-medium text-ink">{summary ?? (count ? `${count} unsaved ${count === 1 ? 'change' : 'changes'}` : 'Unsaved changes')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onDiscard} disabled={pending}>Discard</Button>
        <Button type="button" variant={onSaveAndDeploy ? 'default' : 'primary'} onClick={onSave} loading={pending}>{saveLabel}</Button>
        {onSaveAndDeploy ? <Button type="button" variant="primary" onClick={onSaveAndDeploy} loading={pending}>Save and deploy…</Button> : null}
      </div>
    </div>
    </div>, document.body,
  )
}
