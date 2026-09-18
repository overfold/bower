import { NextRequest, NextResponse } from 'next/server'
import {
  getProtectedRoute,
  hasProjectViewerAccess,
  passwordRouteGrantMatches,
  routeAuthCookieName,
  routeMatchesUrl,
  verifyRouteAuthToken,
} from '@/lib/route-auth'

export async function GET(request: NextRequest, context: { params: Promise<{ routeId: string }> }) {
  const { routeId } = await context.params
  const route = await getProtectedRoute(routeId)
  if (!route) return new NextResponse('Route not found.', { status: 404 })

  const token = request.cookies.get(routeAuthCookieName(routeId))?.value
  if (token) {
    const grant = verifyRouteAuthToken(token, 'grant')
    const userId = grant?.routeId === routeId && grant.protectionMode === 'bower_auth' ? grant.userId : null
    if (grant?.routeId === routeId && route.protectionMode === 'password' && passwordRouteGrantMatches(grant, route.passwordHash)) {
      return new NextResponse(null, { status: 204 })
    }
    if (route.protectionMode === 'bower_auth' && userId && await hasProjectViewerAccess(userId, route.projectId)) {
      return new NextResponse(null, { status: 204 })
    }
  }

  const host = request.headers.get('x-forwarded-host')
  const uri = request.headers.get('x-forwarded-uri') || '/'
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const protocol = forwardedProto === 'http' ? 'http' : 'https'
  if (!host) return new NextResponse('Missing forwarded host.', { status: 400 })
  let target: URL
  try {
    target = new URL(uri, `${protocol}://${host}`)
  } catch {
    return new NextResponse('Invalid forwarded URL.', { status: 400 })
  }
  if (!routeMatchesUrl(route, target)) return new NextResponse('Route mismatch.', { status: 403 })

  const publicUrl = process.env.BOWER_PUBLIC_URL
  if (!publicUrl) return new NextResponse('Bower route authentication is not configured.', { status: 503 })
  const authorize = new URL('/api/route-auth/authorize', publicUrl)
  authorize.searchParams.set('route', routeId)
  authorize.searchParams.set('returnTo', target.toString())
  return NextResponse.redirect(authorize)
}
