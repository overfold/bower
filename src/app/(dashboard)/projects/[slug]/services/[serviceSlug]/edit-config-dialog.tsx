'use client'

import { useState } from 'react'
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
import { Pencil, ChevronDown } from 'lucide-react'

interface EditConfigDialogProps {
  serviceId: string
  config: {
    image: string
    port: number | null
    cpu: number
    memory: number
    deploymentStrategy: string
    resourceTier: string
    healthCheckPath: string | null
    healthCheckType: string | null
    healthCheckCommand: unknown
    healthCheckInterval: number
    healthCheckTimeout: number
    healthCheckThreshold: number
    command: string | null
    cronSchedule: string | null
    autoRollbackSeconds: number
    labels: unknown
    volumes: unknown
    rawConfig: unknown
    canarySteps: unknown
  }
}

function recordToLines(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => `${key}=${String(entry)}`).join('\n')
}

export function EditConfigDialog({ serviceId, config }: EditConfigDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tier, setTier] = useState(config.resourceTier)
  const [healthType, setHealthType] = useState(config.healthCheckType ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      await updateServiceConfigAction(serviceId, formData)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Pencil className="h-4 w-4" />
          Edit service
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit service definition</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="labels" value={recordToLines(config.labels)} />
          <input type="hidden" name="volumes" value={JSON.stringify(config.volumes ?? [])} />
          <input type="hidden" name="rawConfig" value={config.rawConfig ? JSON.stringify(config.rawConfig) : ''} />
          <input type="hidden" name="canarySteps" value={JSON.stringify(config.canarySteps ?? [10, 25, 50, 100])} />
          <input type="hidden" name="healthCommand" value={Array.isArray(config.healthCheckCommand) ? config.healthCheckCommand.join(' ') : ''} />
          <input type="hidden" name="healthInterval" value={config.healthCheckInterval} />
          <input type="hidden" name="healthTimeout" value={config.healthCheckTimeout} />
          <input type="hidden" name="healthThreshold" value={config.healthCheckThreshold} />
          <DialogBody>
            <div className="space-y-4">
              {error && (
                <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-500">{error}</div>
              )}

              <div className="space-y-2">
                <Label htmlFor="image">Container image</Label>
                <Input id="image" name="image" defaultValue={config.image} required mono />
                <p className="text-2xs leading-relaxed text-ink-muted">This is the desired service definition. Environments keep their currently deployed revision until you deploy to them.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="strategy">Deployment strategy</Label>
                  <div className="relative">
                    <select
                      id="strategy"
                      name="strategy"
                      defaultValue={config.deploymentStrategy}
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
                <div className="space-y-2">
                  <Label htmlFor="port">Application port</Label>
                  <Input id="port" name="port" type="number" defaultValue={config.port ?? ''} />
                  <p className="text-2xs leading-relaxed text-ink-muted">Used by health checks and Bower routing; workloads stay on namespace networking.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resourceTier">Resource tier</Label>
                <div className="relative">
                  <select
                    id="resourceTier"
                    name="resourceTier"
                    defaultValue={config.resourceTier}
                    onChange={(e) => setTier(e.target.value)}
                    className="flex h-9 w-full appearance-none rounded-lg border border-line bg-surface px-3 pr-9 text-[13px] text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-enter focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="small">small</option>
                    <option value="medium">medium</option>
                    <option value="large">large</option>
                    <option value="xl">xl</option>
                    <option value="custom">custom</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                </div>
              </div>

              {tier === 'custom' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cpu">CPU (millicores)</Label>
                    <Input id="cpu" name="cpu" type="number" defaultValue={config.cpu} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memory">Memory (MB)</Label>
                    <Input id="memory" name="memory" type="number" defaultValue={config.memory / 1048576} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="healthType">Health check type</Label>
                  <div className="relative">
                    <select
                      id="healthType"
                      name="healthType"
                      defaultValue={config.healthCheckType ?? ''}
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
                    <Label htmlFor="healthPath">Health check path</Label>
                    <Input id="healthPath" name="healthPath" defaultValue={config.healthCheckPath ?? ''} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="command">Command</Label>
                <Input id="command" name="command" defaultValue={config.command ?? ''} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cronSchedule">Cron schedule</Label>
                <Input id="cronSchedule" name="cronSchedule" defaultValue={config.cronSchedule ?? ''} mono />
              </div>

              <div className="space-y-2">
                <Label htmlFor="autoRollbackSeconds">Auto-rollback timeout (seconds)</Label>
                <Input id="autoRollbackSeconds" name="autoRollbackSeconds" type="number" defaultValue={config.autoRollbackSeconds} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="default" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save service'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
