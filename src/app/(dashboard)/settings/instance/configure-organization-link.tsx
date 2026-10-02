'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { switchOrgAction } from '@/lib/auth-actions'
import { Button } from '@/components/ui/button'

export function ConfigureOrganizationLink({ organizationId }: { organizationId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto px-0"
      loading={pending}
      onClick={() => startTransition(async () => {
        await switchOrgAction(organizationId)
        router.push('/settings/cluster')
      })}
    >
      {pending ? 'Opening…' : 'Configure'}
    </Button>
  )
}
