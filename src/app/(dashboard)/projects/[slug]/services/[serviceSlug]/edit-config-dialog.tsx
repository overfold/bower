'use client'

import { useState, useTransition } from 'react'
import { upsertBaseServiceConfigAction, updateServiceConfigOverridesAction, resetServiceConfigOverridesAction } from '@/lib/actions/base-service-config'
import { updateServiceConfigAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Pencil, ChevronDown, RotateCcw } from 'lucide-react'
import type { MergedServiceConfig } from '@/lib/queries'

interface EditConfigDialogProps {
  serviceId: string
  environmentId: string | null
  config: MergedServiceConfig | {
    image: string
    replicas: number
    port: number | null
    cpu: number
    memory: number
    deploymentStrategy: string
    healthCheckPath: string | null
    healthCheckType: string | null
    healthCheckCommand: unknown
    healthCheckInterval: number
    healthCheckTimeout: number
    healthCheckThreshold: number
    command: string | null
    cronSchedule: string | null
    autoRollbackSeconds: number
    envVars: unknown
    labels: unknown
    volumes: unknown
    secretBindings: unknown
    rawConfig: unknown
    canarySteps: unknown
  } | null
  mode: 'base' | 'env'
  overriddenFields: string[]
}

function recordToLines(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => `${key}=${String(entry)}`).join('\n')
}

function FieldOverrideBadge({ fieldName, overriddenFields }: { fieldName: string; overriddenFields: string[] }) {
  if (!overriddenFields.includes(fieldName)) return null
  return <Badge variant="info" className="ml-1.5 align-middle leading-none text-[10px]">override</Badge>
}

export function EditConfigDialog({ serviceId, environmentId, config, mode, overriddenFields }: EditConfigDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetting, startReset] = useTransition()
  const [healthType, setHealthType] = useState(config?.healthCheckType ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      if (mode === 'base') {
        await upsertBaseServiceConfigAction(serviceId, formData)
      } else if (environmentId) {
        await updateServiceConfigOverridesAction(serviceId, environmentId, formData)
      } else {
        await updateServiceConfigAction(serviceId, environmentId as unknown as string, formData)
      }
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    if (!environmentId) return
    startReset(async () => {
      try {
        await resetServiceConfigOverridesAction(serviceId, environmentId)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reset overrides.')
      }
    })
  }

  const defaults = {
    image: config?.image ?? '',
    replicas: config?.replicas ?? 1,
    port: config?.port ?? null,
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

  const hasOverrides = overriddenFields.length > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit configuration</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="envVars" value={recordToLines(config?.envVars)} />
          <input type="hidden" name="labels" value={recordToLines(config?.labels)} />
          <input type="hidden" name="volumes" value={JSON.stringify(config?.volumes ?? [])} />
          <input type="hidden" name="secretBindings" value={JSON.stringify(config?.secretBindings ?? [])} />
          <input type="hidden" name="rawConfig" value={config?.rawConfig ? JSON.stringify(config.rawConfig) : ''} />
          <input type="hidden" name="canarySteps" value={JSON.stringify(config?.canarySteps ?? [10, 25, 50, 100])} />
          <input type="hidden" name="healthCommand" value={defaults.healthCheckCommand} />
          <input type="hidden" name="healthInterval" value={defaults.healthCheckInterval} />
          <input type="hidden" name="healthTimeout" value={defaults.healthCheckTimeout} />
          <input type="hidden" name="healthThreshold" value={defaults.healthCheckThreshold} />
          <DialogBody>
            <div className="space-y-4">
              {error && (
                <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div>
              )}

              {mode === 'base' && (
                <div className="rounded-lg border border-info-200 bg-info-50 p-3 text-[12.5px] leading-relaxed text-info-500">
                  Changes propagate to all environments that haven&apos;t overridden the field.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="image">
                  Container image
                  <FieldOverrideBadge fieldName="image" overriddenFields={overriddenFields} />
                </Label>
                <Input id="image" name="image" defaultValue={defaults.image} required mono />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="replicas">
                    Replicas
                    <FieldOverrideBadge fieldName="replicas" overriddenFields={overriddenFields} />
                  </Label>
                  <Input id="replicas" name="replicas" type="number" defaultValue={defaults.replicas} required min={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="strategy">
                    Deployment strategy
                    <FieldOverrideBadge fieldName="deploymentStrategy" overriddenFields={overriddenFields} />
                  </Label>
                  <div className="relative">
                    <select
                      id="strategy"
                      name="strategy"
                      defaultValue={defaults.deploymentStrategy}
                      className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 pr-9 text-[13px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-enter focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="rolling">rolling</option>
                      <option value="recreate">recreate</option>
                      <option value="blue_green">blue_green</option>
                      <option value="canary">canary</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  </div>
                </div>
              </div>

              <input type="hidden" name="resourceTier" value="custom" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cpu">
                    CPU (millicores)
                    <FieldOverrideBadge fieldName="cpu" overriddenFields={overriddenFields} />
                  </Label>
                  <Input id="cpu" name="cpu" type="number" defaultValue={defaults.cpu} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memory">
                    Memory (MB)
                    <FieldOverrideBadge fieldName="memory" overriddenFields={overriddenFields} />
                  </Label>
                  <Input id="memory" name="memory" type="number" defaultValue={defaults.memory} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="port">
                    Application port
                    <FieldOverrideBadge fieldName="port" overriddenFields={overriddenFields} />
                  </Label>
                  <Input id="port" name="port" type="number" defaultValue={defaults.port ?? ''} />
                  <p className="text-2xs leading-relaxed text-ink-muted">Used by health checks and Bower routing; workloads stay on namespace networking.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="healthType">
                    Health check type
                    <FieldOverrideBadge fieldName="healthCheckType" overriddenFields={overriddenFields} />
                  </Label>
                  <div className="relative">
                    <select
                      id="healthType"
                      name="healthType"
                      defaultValue={defaults.healthCheckType}
                      onChange={(e) => setHealthType(e.target.value)}
                      className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 pr-9 text-[13px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-enter focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="">--</option>
                      <option value="http">http</option>
                      <option value="tcp">tcp</option>
                      <option value="script">script</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  </div>
                </div>
                {healthType === 'http' && (
                  <div className="space-y-2">
                    <Label htmlFor="healthPath">
                      Health check path
                      <FieldOverrideBadge fieldName="healthCheckPath" overriddenFields={overriddenFields} />
                    </Label>
                    <Input id="healthPath" name="healthPath" defaultValue={defaults.healthCheckPath} mono />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="command">
                  Command
                  <FieldOverrideBadge fieldName="command" overriddenFields={overriddenFields} />
                </Label>
                <Input id="command" name="command" defaultValue={defaults.command} mono />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cronSchedule">
                  Cron schedule
                  <FieldOverrideBadge fieldName="cronSchedule" overriddenFields={overriddenFields} />
                </Label>
                <Input id="cronSchedule" name="cronSchedule" defaultValue={defaults.cronSchedule} mono />
              </div>

              <div className="space-y-2">
                <Label htmlFor="autoRollbackSeconds">Auto-rollback timeout (seconds)</Label>
                <Input id="autoRollbackSeconds" name="autoRollbackSeconds" type="number" defaultValue={defaults.autoRollbackSeconds} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            {mode === 'env' && hasOverrides && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="mr-auto text-ink-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to base
              </Button>
            )}
            <Button variant="default" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
