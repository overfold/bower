import { NextRequest, NextResponse } from 'next/server'
import {
  createPasswordRouteGrant,
  createRouteGrant,
  getProtectedRoute,
  hasProjectViewerAccess,
  routeAuthCookieName,
  routeMatchesUrl,
  verifyRouteAuthToken,
} from '@/lib/route-auth'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const handoff = token ? verifyRouteAuthToken(token, 'handoff') : null
  if (!handoff?.target) return new NextResponse('Invalid or expired route authorization.', { status: 403 })

  const route = await getProtectedRoute(handoff.routeId)
  let target: URL
  try {
    target = new URL(handoff.target)
  } catch {
    return new NextResponse('Invalid route authorization target.', { status: 403 })
  }
  const authorized = route && routeMatchesUrl(route, target) && (
    handoff.protectionMode === 'password'
      ? route.protectionMode === 'password'
      : handoff.userId !== undefined && route.protectionMode === 'bower_auth' && await hasProjectViewerAccess(handoff.userId, route.projectId)
  )
  if (!authorized) {
    return new NextResponse('You do not have access to this project.', { status: 403 })
  }

  const response = NextResponse.redirect(target)
  response.cookies.set({
    name: routeAuthCookieName(route.id),
    value: handoff.protectionMode === 'password'
      ? createPasswordRouteGrant(route.id, route.passwordHash!)
      : createRouteGrant(route.id, handoff.userId!),
    httpOnly: true,
    secure: target.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,
  })
  return response
}
