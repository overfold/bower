'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { updateServiceEnvironmentOverridesAction } from '@/lib/actions/service-settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { BowerSecretBinding } from '@/lib/job-builder'

function recordToLines(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => `${key}=${String(entry)}`).join('\n')
}

function normalizeBindings(value: unknown): BowerSecretBinding[] {
  if (!Array.isArray(value)) return []
  const result: BowerSecretBinding[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name : ''
    if (!name) continue
    if (row.target === 'env' && typeof row.env === 'string') {
      result.push({ name, target: 'env', env: row.env })
    } else if (row.target === 'file' && typeof row.path === 'string') {
      result.push({ name, target: 'file', path: row.path })
    }
  }
  return result
}

export function ServiceEnvironmentDialog({
  serviceId,
  environmentId,
  serviceName,
  envVars,
  secretBindings,
  secretNames,
}: {
  serviceId: string
  environmentId: string
  serviceName: string
  envVars: unknown
  secretBindings: unknown
  secretNames: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [bindings, setBindings] = useState<BowerSecretBinding[]>(() => normalizeBindings(secretBindings))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateBinding(index: number, patch: Partial<BowerSecretBinding>) {
    setBindings((current) => current.map((binding, at) => at === index ? { ...binding, ...patch } as BowerSecretBinding : binding))
  }

  function changeTarget(index: number, target: 'env' | 'file') {
    const name = bindings[index].name || secretNames[0] || 'SECRET'
    setBindings((current) => current.map((binding, at) => {
      if (at !== index) return binding
      return target === 'env'
        ? { name, target: 'env', env: name }
        : { name, target: 'file', path: `/run/trellis-secrets/${name}` }
    }))
  }

  function addBinding() {
    const name = secretNames[0] ?? ''
    setBindings((current) => [...current, { name, target: 'env', env: name || 'SECRET' }])
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData(event.currentTarget)
      formData.set('secretBindings', JSON.stringify(bindings))
      await updateServiceEnvironmentOverridesAction(serviceId, environmentId, formData)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update environment configuration.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">Edit configuration</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{serviceName} · environment configuration</DialogTitle></DialogHeader>
        <form onSubmit={submit}>
          <DialogBody>
            <div className="space-y-6">
              {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>}
              <div className="space-y-2">
                <Label htmlFor={`env-vars-${serviceId}`}>Service variables</Label>
                <Textarea
                  id={`env-vars-${serviceId}`}
                  name="envVars"
                  rows={6}
                  defaultValue={recordToLines(envVars)}
                  placeholder={'LOG_LEVEL=info\nFEATURE_FLAG=true'}
                  className="font-mono text-xs"
                />
                <p className="text-2xs leading-relaxed text-ink-muted">Plain, environment-specific values for this service. Use secret bindings below for sensitive values.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">Secret bindings</p>
                    <p className="mt-0.5 text-2xs text-ink-muted">Bind a secret from this environment to an env var or protected file.</p>
                  </div>
                  <Button variant="default" size="sm" type="button" onClick={addBinding} disabled={secretNames.length === 0}>
                    <Plus className="h-3.5 w-3.5" />Add binding
                  </Button>
                </div>
                {secretNames.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-line-strong bg-sunken p-4 text-[12px] text-ink-muted">Create an environment secret before adding a binding.</div>
                ) : bindings.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-line-strong bg-sunken p-4 text-[12px] text-ink-muted">No secrets are bound to this service.</div>
                ) : (
                  <div className="space-y-3">
                    {bindings.map((binding, index) => (
                      <div key={index} className="grid gap-3 rounded-xl border border-line bg-sunken p-3 sm:grid-cols-[1fr_120px_1fr_auto] sm:items-end">
                        <div className="space-y-1.5">
                          <Label htmlFor={`secret-${serviceId}-${index}`}>Secret</Label>
                          <select
                            id={`secret-${serviceId}-${index}`}
                            value={binding.name}
                            onChange={(event) => {
                              const name = event.target.value
                              updateBinding(index, binding.target === 'env'
                                ? { name, env: binding.env || name }
                                : { name, path: binding.path || `/run/trellis-secrets/${name}` })
                            }}
                            className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 text-[13px] text-ink shadow-card focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          >
                            {secretNames.map((name) => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`target-${serviceId}-${index}`}>Target</Label>
                          <select
                            id={`target-${serviceId}-${index}`}
                            value={binding.target}
                            onChange={(event) => changeTarget(index, event.target.value as 'env' | 'file')}
                            className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 text-[13px] text-ink shadow-card focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          >
                            <option value="env">Env var</option>
                            <option value="file">File</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`destination-${serviceId}-${index}`}>{binding.target === 'env' ? 'Variable' : 'Path'}</Label>
                          <Input
                            id={`destination-${serviceId}-${index}`}
                            value={binding.target === 'env' ? binding.env ?? '' : binding.path ?? ''}
                            onChange={(event) => updateBinding(index, binding.target === 'env' ? { env: event.target.value } : { path: event.target.value })}
                            mono
                          />
                        </div>
                        <Button variant="ghost" size="sm" type="button" onClick={() => setBindings((current) => current.filter((_, at) => at !== index))} className="text-danger-500 hover:text-danger-500" aria-label="Remove secret binding">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save configuration'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
