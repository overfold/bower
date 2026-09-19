import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { organizationMembers, projects, routes } from '@/db/schema'
import { getProjectRole } from '@/lib/actions/shared'

const GRANT_SECONDS = 8 * 60 * 60
const HANDOFF_SECONDS = 60

type RouteAuthToken = {
  type: 'grant' | 'handoff'
  routeId: string
  protectionMode: 'password' | 'bower_auth'
  userId?: string
  passwordFingerprint?: string
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
    if (
      payload.type !== expectedType ||
      !payload.routeId ||
      !['password', 'bower_auth'].includes(payload.protectionMode) ||
      (payload.protectionMode === 'bower_auth' && !payload.userId) ||
      (payload.type === 'grant' && payload.protectionMode === 'password' && !payload.passwordFingerprint) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) return null
    return payload
  } catch {
    return null
  }
}

export function createRouteGrant(routeId: string, userId: string) {
  return signRouteAuthToken({ type: 'grant', routeId, protectionMode: 'bower_auth', userId }, GRANT_SECONDS)
}

export function createRouteHandoff(routeId: string, userId: string, target: string) {
  return signRouteAuthToken({ type: 'handoff', routeId, protectionMode: 'bower_auth', userId, target }, HANDOFF_SECONDS)
}

function passwordFingerprint(passwordHash: string) {
  return createHash('sha256').update(passwordHash).digest('hex')
}

export function createPasswordRouteGrant(routeId: string, passwordHash: string) {
  return signRouteAuthToken({ type: 'grant', routeId, protectionMode: 'password', passwordFingerprint: passwordFingerprint(passwordHash) }, GRANT_SECONDS)
}

export function createPasswordRouteHandoff(routeId: string, target: string) {
  return signRouteAuthToken({ type: 'handoff', routeId, protectionMode: 'password', target }, HANDOFF_SECONDS)
}

export function passwordRouteGrantMatches(grant: RouteAuthToken, passwordHash: string | null) {
  return grant.protectionMode === 'password' && passwordHash !== null && grant.passwordFingerprint === passwordFingerprint(passwordHash)
}

export function routeAuthCookieName(routeId: string) {
  return `bower_route_${routeId.replaceAll('-', '')}`
}

export function forwardedRouteContext(headers: Pick<Headers, 'get'>) {
  const host = headers.get('x-bower-forwarded-host') || headers.get('x-forwarded-host')
  const uri = headers.get('x-bower-forwarded-uri') || headers.get('x-forwarded-uri') || '/'
  const forwardedProto = headers.get('x-bower-forwarded-proto') || headers.get('x-forwarded-proto')
  return {
    host,
    uri,
    protocol: forwardedProto === 'http' ? 'http' : 'https',
  }
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
  )).limit(1)
  return route && route.protectionMode !== 'none' ? route : null
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
