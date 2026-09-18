import { NextRequest, NextResponse } from 'next/server'
import { validateSession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { createRouteHandoff, getProtectedRoute, hasProjectViewerAccess, routeMatchesUrl } from '@/lib/route-auth'

export async function GET(request: NextRequest) {
  const routeId = request.nextUrl.searchParams.get('route')
  const returnTo = request.nextUrl.searchParams.get('returnTo')
  if (!routeId || !returnTo) return new NextResponse('Missing route authorization parameters.', { status: 400 })

  const route = await getProtectedRoute(routeId)
  let target: URL
  try {
    target = new URL(returnTo)
  } catch {
    return new NextResponse('Invalid return URL.', { status: 400 })
  }
  if (!route || !['http:', 'https:'].includes(target.protocol) || !routeMatchesUrl(route, target)) {
    return new NextResponse('Route not found.', { status: 404 })
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = sessionToken ? await validateSession(sessionToken) : null
  if (!session) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(login)
  }
  if (!await hasProjectViewerAccess(session.user.id, route.projectId)) {
    return new NextResponse('You do not have access to this project.', { status: 403 })
  }

  const callback = new URL('/.bower/auth/callback', target.origin)
  callback.searchParams.set('token', createRouteHandoff(routeId, session.user.id, target.toString()))
  return NextResponse.redirect(callback)
}
