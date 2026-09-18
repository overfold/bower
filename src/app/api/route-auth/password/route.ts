import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword } from '@/lib/auth'
import { createPasswordRouteHandoff, getProtectedRoute, routeMatchesUrl } from '@/lib/route-auth'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const routeId = formData.get('route')
  const returnTo = formData.get('returnTo')
  const password = formData.get('password')
  if (typeof routeId !== 'string' || typeof returnTo !== 'string' || typeof password !== 'string') {
    return new NextResponse('Missing route password parameters.', { status: 400 })
  }

  const route = await getProtectedRoute(routeId)
  let target: URL
  try {
    target = new URL(returnTo)
  } catch {
    return new NextResponse('Invalid return URL.', { status: 400 })
  }
  if (!route || route.protectionMode !== 'password' || !route.passwordHash || !['http:', 'https:'].includes(target.protocol) || !routeMatchesUrl(route, target)) {
    return new NextResponse('Route not found.', { status: 404 })
  }

  if (!await verifyPassword(password, route.passwordHash)) {
    const retry = new URL('/route-auth/password', request.url)
    retry.searchParams.set('route', routeId)
    retry.searchParams.set('returnTo', target.toString())
    retry.searchParams.set('error', 'invalid-password')
    return NextResponse.redirect(retry, { status: 303 })
  }

  const callback = new URL('/.bower/auth/callback', target.origin)
  callback.searchParams.set('token', createPasswordRouteHandoff(routeId, target.toString()))
  return NextResponse.redirect(callback, { status: 303 })
}
