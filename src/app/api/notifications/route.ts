import { getCurrentUser } from '@/lib/auth'
import { getUserOrganization } from '@/lib/queries'
import { loadNotificationFeed } from '@/lib/deployment-notifications'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const ctx = await getUserOrganization(user.id)
  if (!ctx) return new Response('Forbidden', { status: 403 })
  const feed = await loadNotificationFeed({ userId: user.id, orgId: ctx.org.id, orgRole: ctx.role })
  return Response.json(feed, { headers: { 'Cache-Control': 'private, no-store' } })
}
