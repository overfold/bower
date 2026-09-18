'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertBaseServiceConfigAction, updateServiceConfigOverridesAction, resetServiceConfigOverridesAction } from '@/lib/actions/base-service-config'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, RotateCcw } from 'lucide-react'
import type { MergedServiceConfig } from '@/lib/queries'

interface ConfigurationFormProps {
  serviceId: string
  environmentId: string | null
  config: MergedServiceConfig | null
  overriddenFields: string[]
}

function OverrideBadge({ field, overriddenFields }: { field: string; overriddenFields: string[] }) {
  if (!overriddenFields.includes(field)) return null
  return <Badge variant="info" className="ml-1.5 align-middle leading-none text-[10px]">override</Badge>
}

function recordToLines(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}=${String(v)}`).join('\n')
}

export function ConfigurationForm({ serviceId, environmentId, config, overriddenFields }: ConfigurationFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [resetting, startReset] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [healthType, setHealthType] = useState(config?.healthCheckType ?? '')
  const hasConfigurationOverrides = overriddenFields.some((field) => !['runtime', 'apiAccessScope', 'apiAccessLevel'].includes(field))

  const d = {
    image: config?.image ?? '',
    replicas: config?.replicas ?? 1,
    cpu: config?.cpu ?? 100,
    memory: config ? Math.round(config.memory / 1048576) : 128,
    deploymentStrategy: config?.deploymentStrategy ?? 'rolling',
    healthCheckPath: config?.healthCheckPath ?? '',
    healthCheckType: config?.healthCheckType ?? '',
    healthCheckPort: config?.healthCheckPort ?? '',
    healthCheckCommand: Array.isArray(config?.healthCheckCommand) ? (config.healthCheckCommand as string[]).join(' ') : '',
    healthCheckInterval: config?.healthCheckInterval ?? 10,
    healthCheckTimeout: config?.healthCheckTimeout ?? 2,
    healthCheckThreshold: config?.healthCheckThreshold ?? 3,
    autoRollbackSeconds: config?.autoRollbackSeconds ?? 300,
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData(e.currentTarget)
      if (environmentId) {
        await updateServiceConfigOverridesAction(serviceId, environmentId, formData)
      } else {
        await upsertBaseServiceConfigAction(serviceId, formData)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    if (!environmentId) return
    startReset(async () => {
      try {
        await resetServiceConfigOverridesAction(serviceId, environmentId)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reset overrides.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>
      )}
      <div className="hidden">
        <input type="hidden" name="resourceTier" value="custom" />
        <input type="hidden" name="envVars" value={recordToLines(config?.envVars)} />
        <input type="hidden" name="labels" value={recordToLines(config?.labels)} />
        <input type="hidden" name="volumes" value={JSON.stringify(config?.volumes ?? [])} />
        <input type="hidden" name="secretBindings" value={JSON.stringify(config?.secretBindings ?? [])} />
        <input type="hidden" name="canarySteps" value={JSON.stringify(config?.canarySteps ?? [10, 25, 50, 100])} />
      </div>

      <Panel>
        <PanelHeader title="General" hint="Image and deployment behavior" />
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="image">
              Container image
              <OverrideBadge field="image" overriddenFields={overriddenFields} />
            </Label>
            <Input id="image" name="image" defaultValue={d.image} required mono />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="replicas">
                Replicas
                <OverrideBadge field="replicas" overriddenFields={overriddenFields} />
              </Label>
              <Input id="replicas" name="replicas" type="number" defaultValue={d.replicas} required min={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="strategy">
                Deployment strategy
                <OverrideBadge field="deploymentStrategy" overriddenFields={overriddenFields} />
              </Label>
              <div className="relative">
                <select
                  id="strategy"
                  name="strategy"
                  defaultValue={d.deploymentStrategy}
                  className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 pr-9 text-[13px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-enter focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option value="rolling">Rolling</option>
                  <option value="recreate">Recreate</option>
                  <option value="blue_green">Blue/green</option>
                  <option value="canary">Canary</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Resources" hint="Compute reserved for each replica" />
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cpu">
              CPU (millicores)
              <OverrideBadge field="cpu" overriddenFields={overriddenFields} />
            </Label>
            <Input id="cpu" name="cpu" type="number" defaultValue={d.cpu} min={0} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memory">
              Memory (MB)
              <OverrideBadge field="memory" overriddenFields={overriddenFields} />
            </Label>
            <Input id="memory" name="memory" type="number" defaultValue={d.memory} min={0} required />
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Health checks" hint="Determine when a deployment is ready and healthy" />
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="healthType">
                Health check type
                <OverrideBadge field="healthCheckType" overriddenFields={overriddenFields} />
              </Label>
              <div className="relative">
                <select
                  id="healthType"
                  name="healthType"
                  defaultValue={d.healthCheckType}
                  onChange={(e) => setHealthType(e.target.value)}
                  className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 pr-9 text-[13px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-enter focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">None</option>
                  <option value="http">HTTP</option>
                  <option value="tcp">TCP</option>
                  <option value="script">Script</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
              </div>
            </div>
            {healthType === 'http' && (
              <div className="space-y-2">
                <Label htmlFor="healthPath">Health check path<OverrideBadge field="healthCheckPath" overriddenFields={overriddenFields} /></Label>
                <Input id="healthPath" name="healthPath" defaultValue={d.healthCheckPath} mono />
              </div>
            )}
            {(healthType === 'http' || healthType === 'tcp') && (
              <div className="space-y-2">
                <Label htmlFor="healthPort">Health check port<OverrideBadge field="healthCheckPort" overriddenFields={overriddenFields} /></Label>
                <Input id="healthPort" name="healthPort" type="number" min={1} max={65535} defaultValue={d.healthCheckPort} required />
              </div>
            )}
          </div>

          {healthType === 'script' && (
            <div className="space-y-2">
              <Label htmlFor="healthCommand">Health check command<OverrideBadge field="healthCheckCommand" overriddenFields={overriddenFields} /></Label>
              <Input id="healthCommand" name="healthCommand" defaultValue={d.healthCheckCommand} required mono />
            </div>
          )}

          {healthType && (
            <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="healthInterval">Check interval (seconds)</Label><Input id="healthInterval" name="healthInterval" type="number" min={0} defaultValue={d.healthCheckInterval} /></div>
              <div className="space-y-2"><Label htmlFor="healthTimeout">Check timeout (seconds)</Label><Input id="healthTimeout" name="healthTimeout" type="number" min={0} defaultValue={d.healthCheckTimeout} /></div>
              <div className="space-y-2"><Label htmlFor="healthThreshold">Failure threshold</Label><Input id="healthThreshold" name="healthThreshold" type="number" min={0} defaultValue={d.healthCheckThreshold} /></div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="autoRollbackSeconds">Failure grace period (seconds)</Label>
              <Input id="autoRollbackSeconds" name="autoRollbackSeconds" type="number" min={30} defaultValue={d.autoRollbackSeconds} className="max-w-48" />
            </div>
            </>
          )}
        </div>
      </Panel>

      <div className="flex items-center justify-between gap-3">
        {environmentId && hasConfigurationOverrides ? (
          <Button variant="ghost" size="sm" type="button" onClick={handleReset} disabled={resetting} className="text-ink-muted">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </Button>
        ) : (
          <div />
        )}
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save configuration'}
        </Button>
      </div>
    </form>
  )
}
