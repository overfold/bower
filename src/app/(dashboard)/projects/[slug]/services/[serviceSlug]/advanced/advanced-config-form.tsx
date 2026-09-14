'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { updateServiceAdvancedAction } from '@/lib/actions/service-settings'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function AdvancedConfigForm({
  serviceId,
  runtime: initialRuntime,
  apiAccessScope,
  apiAccessLevel,
}: {
  serviceId: string
  runtime: string | null | undefined
  apiAccessScope: string | null | undefined
  apiAccessLevel: string | null | undefined
}) {
  const router = useRouter()
  const [runtime, setRuntime] = useState(initialRuntime === 'runsc' ? 'runsc' : 'runc')
  const initialAccess = apiAccessScope && apiAccessLevel ? `${apiAccessScope}:${apiAccessLevel}` : 'none'
  const [apiAccess, setApiAccess] = useState(initialAccess)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sensitive = apiAccess.startsWith('cluster:') || apiAccess.endsWith(':write')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData(event.currentTarget)
      await updateServiceAdvancedAction(serviceId, formData)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update advanced settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 p-4">
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="runtime">Runtime</Label>
          <select
            id="runtime"
            name="runtime"
            value={runtime}
            onChange={(event) => setRuntime(event.target.value)}
            className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 text-[13px] text-ink shadow-card focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="runc">runc — standard OCI runtime</option>
            <option value="runsc">runsc — gVisor sandbox</option>
          </select>
          <p className="text-2xs leading-relaxed text-ink-muted">
            Runtime selection applies to the whole Trellis task group, including sidecars, in every environment.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="api-access">Workload API access</Label>
          <select
            id="api-access"
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
            Trellis injects a scoped workload credential only when API access is enabled.
          </p>
        </div>
      </div>
      {sensitive && (
        <div className="flex gap-2 rounded-lg border border-warn-200 bg-warn-50 p-3 text-[12px] leading-relaxed text-warn-500">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This grants the workload elevated control-plane access in every environment. Prefer namespace read access unless the workload genuinely needs broader or mutating permissions.
          </span>
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="primary" size="sm" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save advanced settings'}</Button>
      </div>
    </form>
  )
}
