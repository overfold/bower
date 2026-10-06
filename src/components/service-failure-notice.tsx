import Link from 'next/link'
import { InlineNotice } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { RestartCountdown } from '@/components/restart-countdown'
import type { ServiceFailure } from '@/lib/service-failure'

/** The cause of a failing service in the page body, where people look first: one line, one action. */
export function ServiceFailureNotice({ failure, logsHref }: { failure: ServiceFailure; logsHref?: string }) {
  return <InlineNotice tone="danger" action={logsHref ? <Button asChild size="sm"><Link href={logsHref}>{failure.kind === 'unplaceable' ? 'View allocation' : 'View logs'}</Link></Button> : undefined}>
    <p className="break-words">{failure.cause}</p>
    {failure.nextAttemptAt ? <p className="mt-0.5 text-xs text-ink-muted">Restart pending · <RestartCountdown at={failure.nextAttemptAt} /></p> : null}
  </InlineNotice>
}
