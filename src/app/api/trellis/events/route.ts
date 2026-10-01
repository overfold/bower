import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization, getProjectsForUser } from '@/lib/queries'
import { getTrellisClient } from '@/lib/trellis-instance'
import { db } from '@/db'
import { environments } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const ctx = await getUserOrganization(user.id)
  if (!ctx) return new Response('Forbidden', { status: 403 })
  const { searchParams } = new URL(request.url)
  const namespace = searchParams.get('namespace')
  if (!namespace) return new Response('Namespace is required', { status: 400 })
  const projects = await getProjectsForUser(ctx.org.id, user.id, ctx.role)
  const [environment] = projects.length ? await db.select({ id: environments.id }).from(environments)
    .where(and(eq(environments.trellisNamespace, namespace), inArray(environments.projectId, projects.map((project) => project.id)))).limit(1) : []
  if (!environment) return new Response('Forbidden', { status: 403 })
  let upstream: Response
  try {
    const client = await getTrellisClient(ctx.org.id)
    upstream = await client.streamEvents(namespace, request.signal)
  } catch {
    return new Response('Trellis unreachable', { status: 502 })
  }
  if (!upstream.ok) {
    await upstream.body?.cancel()
    return new Response('Trellis event stream unavailable', { status: 502 })
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
