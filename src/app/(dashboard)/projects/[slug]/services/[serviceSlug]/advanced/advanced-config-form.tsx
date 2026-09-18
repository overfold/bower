'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, ShieldAlert } from 'lucide-react'
import { resetServiceAdvancedOverridesAction, updateBaseServiceAdvancedAction, updateServiceAdvancedAction } from '@/lib/actions/service-settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const ADVANCED_FIELDS = ['runtime', 'apiAccessScope', 'apiAccessLevel'] as const

function OverrideBadge({ fields, overriddenFields }: { fields: readonly string[]; overriddenFields: string[] }) {
  if (!fields.some((field) => overriddenFields.includes(field))) return null
  return <Badge variant="info" className="ml-1.5 align-middle leading-none text-[10px]">override</Badge>
}

export function AdvancedConfigForm({
  serviceId,
  environmentId,
  runtime: initialRuntime,
  apiAccessScope,
  apiAccessLevel,
  overriddenFields,
}: {
  serviceId: string
  environmentId: string | null
  runtime: 'runc' | 'runsc'
  apiAccessScope: 'namespace' | 'cluster' | null
  apiAccessLevel: 'read' | 'write' | null
  overriddenFields: string[]
}) {
  const router = useRouter()
  const [runtime, setRuntime] = useState(initialRuntime)
  const initialAccess = apiAccessScope && apiAccessLevel ? `${apiAccessScope}:${apiAccessLevel}` : 'none'
  const [apiAccess, setApiAccess] = useState(initialAccess)
  const [saving, setSaving] = useState(false)
  const [resetting, startReset] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const sensitive = apiAccess.startsWith('cluster:') || apiAccess.endsWith(':write')
  const hasOverrides = environmentId !== null && ADVANCED_FIELDS.some((field) => overriddenFields.includes(field))

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData(event.currentTarget)
      if (environmentId) await updateServiceAdvancedAction(serviceId, environmentId, formData)
      else await updateBaseServiceAdvancedAction(serviceId, formData)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update advanced settings.')
    } finally {
      setSaving(false)
    }
  }

  function resetToBase() {
    if (!environmentId) return
    startReset(async () => {
      setError(null)
      try {
        await resetServiceAdvancedOverridesAction(serviceId, environmentId)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reset advanced settings.')
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5 p-4">
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`runtime-${environmentId ?? 'base'}`}>
            Isolation
            <OverrideBadge fields={['runtime']} overriddenFields={overriddenFields} />
          </Label>
          <select
            id={`runtime-${environmentId ?? 'base'}`}
            name="runtime"
            value={runtime}
            onChange={(event) => setRuntime(event.target.value as 'runc' | 'runsc')}
            className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 text-[13px] text-ink shadow-card focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="runc">Standard — best compatibility</option>
            <option value="runsc">Sandboxed — additional isolation</option>
          </select>
          <p className="text-2xs leading-relaxed text-ink-muted">
            Isolation mode applies to the whole service group, including sidecars.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`api-access-${environmentId ?? 'base'}`}>
            Workload API access
            <OverrideBadge fields={['apiAccessScope', 'apiAccessLevel']} overriddenFields={overriddenFields} />
          </Label>
          <select
            id={`api-access-${environmentId ?? 'base'}`}
            name="apiAccess"
            value={apiAccess}
            onChange={(event) => setApiAccess(event.target.value)}
            className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 text-[13px] text-ink shadow-card focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="none">None</option>
            <option value="namespace:read">Namespace · read</option>
            <option value="namespace:write">Namespace · write</option>
            <option value="cluster:read">Cluster · read</option>
            <option value="cluster:write">Cluster · write</option>
          </select>
          <p className="text-2xs leading-relaxed text-ink-muted">
            Enabling API access gives the workload a scoped credential.
          </p>
        </div>
      </div>
      {sensitive && (
        <div className="flex gap-2 rounded-lg border border-warn-200 bg-warn-50 p-3 text-[12px] leading-relaxed text-warn-500">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This grants the workload elevated API access. Prefer namespace read access unless it genuinely needs broader or mutating permissions.
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        {hasOverrides ? (
          <Button variant="ghost" size="sm" type="button" onClick={resetToBase} disabled={resetting} className="text-ink-muted">
            <RotateCcw className="h-3.5 w-3.5" />
            {resetting ? 'Resetting…' : 'Reset to base'}
          </Button>
        ) : (
          <div />
        )}
        <Button variant="primary" size="sm" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save advanced settings'}</Button>
      </div>
    </form>
  )
}
