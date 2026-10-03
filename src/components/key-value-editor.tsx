'use client'

import { useId, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type KeyValueRow = { id: string; key: string; value: string }

const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/

export function parseEnvText(text: string): Array<{ key: string; value: string }> {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => {
    const normalized = line.startsWith('export ') ? line.slice(7) : line
    const separator = normalized.indexOf('=')
    return separator < 0
      ? { key: normalized.trim().toUpperCase(), value: '' }
      : { key: normalized.slice(0, separator).trim().toUpperCase(), value: normalized.slice(separator + 1) }
  })
}

export function KeyValueEditor({
  name = 'envVars',
  initialRows,
  preserveBlankValues = false,
  onChange,
}: {
  name?: string
  initialRows: Array<{ key: string; value: string }>
  preserveBlankValues?: boolean
  onChange?: () => void
}) {
  const id = useId()
  const [rows, setRows] = useState<KeyValueRow[]>(() => initialRows.map((row, index) => ({ ...row, id: `${index}-${row.key}` })))
  const [pasteError, setPasteError] = useState('')
  const duplicateKeys = useMemo(() => {
    const seen = new Set<string>(); const duplicates = new Set<string>()
    for (const row of rows) { if (row.key && seen.has(row.key)) duplicates.add(row.key); seen.add(row.key) }
    return duplicates
  }, [rows])

  const serialized = JSON.stringify(rows.map(({ key, value }) => ({ key, value })))
  function patch(index: number, value: Partial<KeyValueRow>) {
    setRows((current) => current.map((row, at) => at === index ? { ...row, ...value } : row))
    onChange?.()
  }
  async function paste() {
    setPasteError('')
    try {
      const parsed = parseEnvText(await navigator.clipboard.readText())
      setRows((current) => [...current, ...parsed.map((row) => ({ ...row, id: crypto.randomUUID() }))])
      onChange?.()
    } catch { setPasteError('Clipboard access was denied.') }
  }

  return <div className="space-y-3">
    <input type="hidden" name={name} value={serialized} />
    {rows.length === 0 ? <div className="rounded-lg border border-dashed border-line-strong bg-sunken p-4 text-xs text-ink-muted">No variables configured.</div> : null}
    {rows.map((row, index) => {
      const invalid = row.key.length > 0 && !ENV_NAME.test(row.key)
      const duplicate = duplicateKeys.has(row.key)
      return <div key={row.id} className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-start">
        <div>
          <Input aria-label={`Variable ${index + 1} name`} value={row.key} onChange={(event) => patch(index, { key: event.target.value.toUpperCase() })} mono required pattern="[A-Z_][A-Z0-9_]*" ref={(input) => input?.setCustomValidity(duplicate ? 'Variable names must be unique.' : '')} aria-invalid={invalid || duplicate} />
          {invalid ? <p className="mt-1 text-2xs text-danger-500">Use uppercase letters, numbers, and underscores; do not start with a number.</p> : duplicate ? <p className="mt-1 text-2xs text-danger-500">Variable names must be unique.</p> : null}
        </div>
        <Input aria-label={`Variable ${index + 1} value`} value={row.value} onChange={(event) => patch(index, { value: event.target.value })} mono required={!preserveBlankValues || !initialRows.some((item) => item.key === row.key)} />
        <Button type="button" variant="ghost" size="sm" onClick={() => { setRows((current) => current.filter((_, at) => at !== index)); onChange?.() }} aria-label={`Delete ${row.key || `variable ${index + 1}`}`}><Trash2 className="h-4 w-4" /></Button>
      </div>
    })}
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" onClick={() => { setRows((current) => [...current, { id: crypto.randomUUID(), key: '', value: '' }]); onChange?.() }}><Plus className="h-4 w-4" />Add variable</Button>
      <Button type="button" size="sm" onClick={paste}>Paste .env</Button>
      {pasteError ? <span id={`${id}-paste-error`} className="text-xs text-danger-500">{pasteError}</span> : null}
    </div>
  </div>
}
