import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { organizationMembers, projects, routes } from '@/db/schema'
import { getProjectRole } from '@/lib/actions/shared'

const GRANT_SECONDS = 8 * 60 * 60
const HANDOFF_SECONDS = 60

type RouteAuthToken = {
  type: 'grant' | 'handoff'
  routeId: string
  userId: string
  target?: string
  exp: number
}

function secret() {
  const value = process.env.BOWER_ROUTE_AUTH_SECRET
  if (!value || value.length < 32) throw new Error('BOWER_ROUTE_AUTH_SECRET must be at least 32 characters.')
  return value
}

export function signRouteAuthToken(payload: Omit<RouteAuthToken, 'exp'>, lifetimeSeconds: number) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + lifetimeSeconds })).toString('base64url')
  const signature = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifyRouteAuthToken(token: string, expectedType: RouteAuthToken['type']): RouteAuthToken | null {
  const [body, suppliedSignature, extra] = token.split('.')
  if (!body || !suppliedSignature || extra) return null
  const expectedSignature = createHmac('sha256', secret()).update(body).digest()
  const supplied = Buffer.from(suppliedSignature, 'base64url')
  if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as RouteAuthToken
    if (payload.type !== expectedType || !payload.routeId || !payload.userId || payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function createRouteGrant(routeId: string, userId: string) {
  return signRouteAuthToken({ type: 'grant', routeId, userId }, GRANT_SECONDS)
}

export function createRouteHandoff(routeId: string, userId: string, target: string) {
  return signRouteAuthToken({ type: 'handoff', routeId, userId, target }, HANDOFF_SECONDS)
}

export function routeAuthCookieName(routeId: string) {
  return `bower_route_${routeId.replaceAll('-', '')}`
}

export function routeMatchesUrl(route: { domain: string; pathPrefix: string }, target: URL) {
  const hostname = target.hostname.toLowerCase()
  const routeDomain = route.domain.toLowerCase()
  const domainMatches = routeDomain.startsWith('*.')
    ? hostname.endsWith(routeDomain.slice(1)) && hostname !== routeDomain.slice(2)
    : hostname === routeDomain
  return domainMatches && target.pathname.startsWith(route.pathPrefix)
}

export async function getProtectedRoute(routeId: string) {
  const [route] = await db.select().from(routes).where(and(
    eq(routes.id, routeId),
    eq(routes.protectionMode, 'bower_auth'),
  )).limit(1)
  return route ?? null
}

export async function hasProjectViewerAccess(userId: string, projectId: string) {
  const [row] = await db.select({ orgRole: organizationMembers.role }).from(projects)
    .innerJoin(organizationMembers, and(
      eq(organizationMembers.orgId, projects.orgId),
      eq(organizationMembers.userId, userId),
    ))
    .where(eq(projects.id, projectId)).limit(1)
  if (!row) return false
  return Boolean(await getProjectRole(userId, row.orgRole, projectId))
}
