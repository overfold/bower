'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { deployServiceAction, restartServiceAction, rollbackServiceAction } from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Rocket, RefreshCw, RotateCcw } from 'lucide-react'
import { useFeedback } from '@/components/ui/feedback'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ServiceConfigDiff } from '@/lib/service-config-diff'
import { Time } from '@/components/time'
import { deploymentImageTag, formatCpu, formatMemory } from '@/lib/format'
import { Chip } from '@/components/status'
import { DialogBody } from '@/components/ui/dialog'

export function ConfigDiffPreview({ changes, afterLabel }: { changes: ServiceConfigDiff[]; afterLabel: string }) {
  if (!changes.length) return <p className="text-sm text-ink-muted">No configuration differences.</p>
  return <div className="overflow-hidden rounded-md border border-line"><div className="grid grid-cols-[minmax(6rem,0.7fr)_1fr_1fr] gap-3 bg-sunken px-3 py-2 text-xs font-semibold text-ink-muted"><span>Field</span><span>Running</span><span>{afterLabel}</span></div>{changes.map((change) => <div key={change.key} className="grid grid-cols-[minmax(6rem,0.7fr)_1fr_1fr] gap-3 border-t border-line px-3 py-2 text-sm">{change.kind === 'environment' ? <><span><Chip tone="neutral">{change.change}</Chip><span className="mt-1 block break-all font-mono text-xs">{change.variable}</span></span><span className="font-mono text-xs text-ink-muted">{change.before.present ? '••••••••' : '—'}</span><span className="font-mono text-xs">{change.after.present ? '••••••••' : '—'}</span></> : <><span className="font-medium text-ink">{change.label}</span><span className={`min-w-0 break-words text-xs text-ink-muted ${change.key === 'image' ? 'font-mono' : ''}`}>{formatDiffValue(change, change.before)}</span><span className={`min-w-0 break-words text-xs text-ink ${change.key === 'image' ? 'font-mono' : ''}`}>{formatDiffValue(change, change.after)}</span></>}</div>)}</div>
}

function formatDiffValue(change: Extract<ServiceConfigDiff, { kind: 'config' }>, value: typeof change.before) {
  if (value == null || value === '') return 'None'
  if (change.key === 'image') return deploymentImageTag(String(value))
  if (change.key === 'cpu') return formatCpu(Number(value))
  if (change.key === 'memory') return formatMemory(Number(value))
  if (change.key === 'health' && typeof value === 'object' && !Array.isArray(value)) {
    const health = value as Record<string, ServiceConfigDiffValue>
    const cadence = `every ${Number(health.interval) / 1e9}s · ${Number(health.timeout) / 1e9}s timeout · ${health.threshold} failures`
    if (health.type === 'http') return `HTTP ${health.path ?? '/'}${health.port ? ` on port ${health.port}` : ''} · ${cadence}`
    if (health.type === 'tcp') return `TCP port ${health.port} · ${cadence}`
    return `Script ${Array.isArray(health.command) ? health.command.join(' ') : health.command} · ${cadence}`
  }
  if (change.key === 'secrets' && Array.isArray(value)) return value.map((item) => {
    const binding = item as Record<string, ServiceConfigDiffValue>
    return `${binding.name} → ${binding.target === 'env' ? binding.env : binding.path}`
  }).join(', ') || 'None'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

type ServiceConfigDiffValue = Extract<ServiceConfigDiff, { kind: 'config' }>['before']

interface ServiceActionsProps {
  serviceId: string
  serviceName: string
  runningImage: string | null
  environmentId: string
  hasDeployments?: boolean
  changes: ServiceConfigDiff[]
  rollbackTargets: { id: string; image: string; createdAt: string; changes: ServiceConfigDiff[] }[]
}

export function ServiceActions({ serviceId, serviceName, runningImage, environmentId, hasDeployments, changes, rollbackTargets }: ServiceActionsProps) {
  const [deploying, startDeploy] = useTransition()
  const [restarting, startRestart] = useTransition()
  const [rollingBack, startRollback] = useTransition()
  const { toast } = useFeedback()
  const params = useSearchParams()
  const pathname = usePathname()
  const [confirmDeploy, setConfirmDeploy] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState(rollbackTargets[0]?.id ?? '')
  const selectedRollback = rollbackTargets.find((target) => target.id === rollbackTarget)
  useEffect(() => {
    if (params.get('action') !== 'deploy') return
    const frame = requestAnimationFrame(() => {
      setConfirmDeploy(true)
      const url = new URL(window.location.href); url.searchParams.delete('action')
      window.history.replaceState(null, '', `${pathname}${url.search}`)
    })
    return () => cancelAnimationFrame(frame)
  }, [params, pathname])

  function run(action: () => Promise<void>, success: string) {
    return async () => {
      try {
        await action()
        toast({ tone: 'success', title: success })
      } catch (reason) {
        toast({ tone: 'danger', title: 'Service action failed', description: reason instanceof Error ? reason.message : 'The service action could not be completed.' })
      }
    }
  }

  return (
    <div className="flex items-center gap-2">
      {hasDeployments && rollbackTargets.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="default" size="sm" loading={rollingBack}>
              <RotateCcw />
              Roll back…
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Roll back {serviceName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Choose an earlier successful release. The selected release will become the running configuration.
                {runningImage ? <span className="mt-1 block">Running <span className="font-mono text-ink">{deploymentImageTag(runningImage)}</span></span> : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <DialogBody className="space-y-4"><div className="space-y-2"><label className="text-sm font-medium text-ink" htmlFor="service-rollback-release">Release</label><Select value={rollbackTarget} onValueChange={setRollbackTarget}><SelectTrigger id="service-rollback-release" aria-label="Rollback release" className="font-mono"><SelectValue /></SelectTrigger><SelectContent>{rollbackTargets.map((target) => <SelectItem key={target.id} value={target.id}><span className="font-mono">{deploymentImageTag(target.image)}</span><span className="ml-2 font-sans text-xs text-ink-muted"><Time value={target.createdAt} /></span></SelectItem>)}</SelectContent></Select></div><ConfigDiffPreview changes={selectedRollback?.changes ?? []} afterLabel="Selected release" /></DialogBody>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button variant="primary" loading={rollingBack} disabled={!rollbackTarget} onClick={() => startRollback(run(() => rollbackServiceAction(serviceId, environmentId, rollbackTarget), 'Rollback started'))}>
                Roll back
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <Button
        variant="default"
        size="sm"
        disabled={restarting}
        aria-busy={restarting}
        onClick={() => startRestart(run(() => restartServiceAction(serviceId, environmentId), 'Service restart started'))}
      >
        <RefreshCw className={restarting ? 'animate-spin' : undefined} />
        Restart
      </Button>
      <Button
        variant={changes.length ? 'primary' : 'default'}
        size="sm"
        disabled={deploying}
        aria-busy={deploying}
        onClick={() => setConfirmDeploy(true)}
      >
        <Rocket />
        {deploying ? 'Deploying...' : 'Deploy'}
      </Button>
      <AlertDialog open={confirmDeploy} onOpenChange={setConfirmDeploy}>
        <AlertDialogContent size="lg">
          <AlertDialogHeader><AlertDialogTitle>Deploy this service?</AlertDialogTitle><AlertDialogDescription>{changes.length ? 'Review the saved changes that will be deployed.' : 'The saved configuration matches the currently running release.'}</AlertDialogDescription></AlertDialogHeader>
          {changes.length ? <DialogBody><ConfigDiffPreview changes={changes} afterLabel="After deploy" /></DialogBody> : null}
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><Button variant="primary" loading={deploying} onClick={() => startDeploy(async () => { await run(() => deployServiceAction(serviceId, environmentId), 'Deployment started')(); setConfirmDeploy(false) })}>Deploy</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
