import { NextRequest, NextResponse } from 'next/server'
import { PasswordWorkBusyError, verifyPassword } from '@/lib/auth'
import { createPasswordRouteHandoff, getProtectedRoute, routeMatchesUrl } from '@/lib/route-auth'
import { consumeAuthAttempt } from '@/lib/auth-abuse'
import { BODY_LIMITS, readRequestBody, requestBodyErrorResponse } from '@/lib/request-body'

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    const raw = await readRequestBody(request, BODY_LIMITS.password)
    formData = await new Request(request.url, { method: 'POST', headers: { 'content-type': request.headers.get('content-type') || '' }, body: new Uint8Array(raw) }).formData()
  } catch (error) { return requestBodyErrorResponse(error) }
  const routeId = formData.get('route')
  const returnTo = formData.get('returnTo')
  const password = formData.get('password')
  if (typeof routeId !== 'string' || typeof returnTo !== 'string' || typeof password !== 'string') {
    return new NextResponse('Missing route password parameters.', { status: 400 })
  }

  if (!await consumeAuthAttempt(request.headers, `route-password:${routeId}`)) {
    return new NextResponse('Too many attempts. Try again later.', { status: 429, headers: { 'Retry-After': '60' } })
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

  let verified: boolean
  try { verified = await verifyPassword(password, route.passwordHash) } catch (error) {
    if (error instanceof PasswordWorkBusyError) return new NextResponse('Too many attempts. Try again later.', { status: 429, headers: { 'Retry-After': '60' } })
    throw error
  }
  if (!verified) {
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
