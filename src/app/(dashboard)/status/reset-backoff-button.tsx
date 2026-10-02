'use client'

import { useState, useTransition } from 'react'
import { resetReplacementBackoffAction } from '@/lib/actions/operations'
import { Button } from '@/components/ui/button'

export function ResetBackoffButton({ namespace, job, group }: { namespace: string; job: string; group: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        onClick={() => startTransition(async () => {
          setError(null)
          try {
            await resetReplacementBackoffAction(namespace, job, group)
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Reset failed.')
          }
        })}
        loading={pending}
      >
        {pending ? 'Restarting…' : 'Restart now'}
      </Button>
      {error ? <p role="alert" className="max-w-56 text-right text-xs text-danger-500">{error}</p> : null}
    </div>
  )
}
