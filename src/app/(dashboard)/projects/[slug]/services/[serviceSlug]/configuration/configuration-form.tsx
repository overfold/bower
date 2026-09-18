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

  const d = {
    image: config?.image ?? '',
    replicas: config?.replicas ?? 1,
    port: config?.port ?? '',
    cpu: config?.cpu ?? 100,
    memory: config ? Math.round(config.memory / 1048576) : 128,
    deploymentStrategy: config?.deploymentStrategy ?? 'rolling',
    healthCheckPath: config?.healthCheckPath ?? '',
    healthCheckType: config?.healthCheckType ?? '',
    healthCheckCommand: Array.isArray(config?.healthCheckCommand) ? (config.healthCheckCommand as string[]).join(' ') : '',
    healthCheckInterval: config?.healthCheckInterval ?? 10,
    healthCheckTimeout: config?.healthCheckTimeout ?? 2,
    healthCheckThreshold: config?.healthCheckThreshold ?? 3,
    command: config?.command ?? '',
    cronSchedule: config?.cronSchedule ?? '',
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
    <Panel>
      <PanelHeader title="Configuration" />
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="resourceTier" value="custom" />
        <input type="hidden" name="envVars" value={recordToLines(config?.envVars)} />
        <input type="hidden" name="labels" value={recordToLines(config?.labels)} />
        <input type="hidden" name="volumes" value={JSON.stringify(config?.volumes ?? [])} />
        <input type="hidden" name="secretBindings" value={JSON.stringify(config?.secretBindings ?? [])} />
        <input type="hidden" name="rawConfig" value={config?.rawConfig ? JSON.stringify(config.rawConfig) : ''} />
        <input type="hidden" name="canarySteps" value={JSON.stringify(config?.canarySteps ?? [10, 25, 50, 100])} />
        <input type="hidden" name="healthCommand" value={d.healthCheckCommand} />
        <input type="hidden" name="healthInterval" value={d.healthCheckInterval} />
        <input type="hidden" name="healthTimeout" value={d.healthCheckTimeout} />
        <input type="hidden" name="healthThreshold" value={d.healthCheckThreshold} />

        <div className="divide-y divide-line">
          <div className="space-y-4 p-4">
            {error && (
              <div className="rounded-md bg-danger-50 p-3 text-[13px] text-danger-500">{error}</div>
            )}

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
                <Input id="replicas" name="replicas" type="number" defaultValue={d.replicas} required min={0} />
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cpu">
                  CPU (millicores)
                  <OverrideBadge field="cpu" overriddenFields={overriddenFields} />
                </Label>
                <Input id="cpu" name="cpu" type="number" defaultValue={d.cpu} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memory">
                  Memory (MB)
                  <OverrideBadge field="memory" overriddenFields={overriddenFields} />
                </Label>
                <Input id="memory" name="memory" type="number" defaultValue={d.memory} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">
                  Application port
                  <OverrideBadge field="port" overriddenFields={overriddenFields} />
                </Label>
                <Input id="port" name="port" type="number" defaultValue={d.port} />
              </div>
            </div>

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
                  <Label htmlFor="healthPath">
                    Health check path
                    <OverrideBadge field="healthCheckPath" overriddenFields={overriddenFields} />
                  </Label>
                  <Input id="healthPath" name="healthPath" defaultValue={d.healthCheckPath} mono />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="command">
                  Command
                  <OverrideBadge field="command" overriddenFields={overriddenFields} />
                </Label>
                <Input id="command" name="command" defaultValue={d.command} mono />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cronSchedule">
                  Cron schedule
                  <OverrideBadge field="cronSchedule" overriddenFields={overriddenFields} />
                </Label>
                <Input id="cronSchedule" name="cronSchedule" defaultValue={d.cronSchedule} mono />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="autoRollbackSeconds">Auto-rollback timeout (seconds)</Label>
              <Input id="autoRollbackSeconds" name="autoRollbackSeconds" type="number" defaultValue={d.autoRollbackSeconds} className="max-w-48" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3">
            {environmentId && overriddenFields.length > 0 ? (
              <Button variant="ghost" size="sm" type="button" onClick={handleReset} disabled={resetting} className="text-ink-muted">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to base
              </Button>
            ) : (
              <div />
            )}
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Panel>
  )
}
