'use client'

import { useEffect, useRef, useState } from 'react'
import { actionErrorMessage } from '@/lib/action-error'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { updateServiceAdvancedAction } from '@/lib/actions/service-settings'
import { Button } from '@/components/ui/button'
import { InlineNotice, useFeedback } from '@/components/ui/feedback'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function AdvancedConfigForm({
  serviceId,
  environmentId,
  runtime: initialRuntime,
  apiAccessScope,
  apiAccessLevel,
  mayBypassMultitenancy,
}: {
  serviceId: string
  environmentId: string
  runtime: 'runc' | 'runsc'
  apiAccessScope: 'cluster' | null
  apiAccessLevel: 'read' | 'write' | null
  mayBypassMultitenancy: boolean
}) {
  const router = useRouter()
  const { toast } = useFeedback()
  const [runtime, setRuntime] = useState(initialRuntime)
  const initialAccess = apiAccessScope && apiAccessLevel ? `${apiAccessScope}:${apiAccessLevel}` : 'none'
  const [apiAccess, setApiAccess] = useState(initialAccess)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const sensitive = apiAccess !== 'none'

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    const guardLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest('a[href]')
      if (dirty && link && !window.confirm('Discard your unsaved advanced settings?')) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', guardLink, true)
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guardLink, true) }
  }, [dirty])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData(event.currentTarget)
      await updateServiceAdvancedAction(serviceId, environmentId, formData)
      setDirty(false)
      toast({ tone: 'success', title: 'Advanced settings saved.' })
      router.refresh()
    } catch (err) {
      setError(actionErrorMessage(err, 'Could not update advanced settings.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} onChange={(event) => { if (!(event.target instanceof HTMLSelectElement)) setDirty(true) }} className="space-y-5 p-4" aria-busy={saving}>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`runtime-${environmentId}`}>Isolation</Label>
          <Select name="runtime" value={runtime} onValueChange={(value) => { setRuntime(value as 'runc' | 'runsc'); setDirty(true) }}>
            <SelectTrigger id={`runtime-${environmentId}`} aria-describedby={`runtime-help-${environmentId}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="runc">None</SelectItem>
              <SelectItem value="runsc">Sandboxed</SelectItem>
            </SelectContent>
          </Select>
          <p id={`runtime-help-${environmentId}`} className="text-2xs leading-relaxed text-ink-muted">
            Sandboxed workloads use stronger process isolation for the whole service.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`api-access-${environmentId}`}>Workload API access</Label>
          <Select name="apiAccess" value={apiAccess} onValueChange={(value) => { setApiAccess(value); setDirty(true) }}>
            <SelectTrigger id={`api-access-${environmentId}`} aria-describedby={`api-access-help-${environmentId}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {mayBypassMultitenancy && <>
                <SelectItem value="cluster:read">Cluster · read</SelectItem>
                <SelectItem value="cluster:write">Cluster · write</SelectItem>
              </>}
            </SelectContent>
          </Select>
          <p id={`api-access-help-${environmentId}`} className="text-2xs leading-relaxed text-ink-muted">
            All Trellis API tokens are cluster-wide, including read-only tokens. Grants require the instance-admin multitenancy bypass.
          </p>
        </div>
      </div>
      {sensitive && (
        <InlineNotice tone="warning" icon={<ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}>
          This service has cluster-wide workload API access. The instance-admin multitenancy bypass must remain enabled to save or deploy it.
        </InlineNotice>
      )}
      {dirty && <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 shadow-raised">
        <span className="text-sm font-medium text-ink">Unsaved changes</span>
        <div className="flex gap-2"><Button type="button" onClick={() => { formRef.current?.reset(); setRuntime(initialRuntime); setApiAccess(initialAccess); setDirty(false) }}>Discard</Button><Button variant="primary" size="sm" type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save advanced settings'}</Button></div>
      </div>}
    </form>
  )
}
