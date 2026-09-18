import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register']
const SESSION_COOKIE_NAME = 'bower_session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  // If the user has a session cookie and is on a public auth page,
  // redirect them to the dashboard
  if (sessionToken && PUBLIC_PATHS.includes(pathname)) {
    const next = request.nextUrl.searchParams.get('next')
    if (next?.startsWith('/') && !next.startsWith('//')) {
      return NextResponse.redirect(new URL(next, request.url))
    }
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  // Allow unauthenticated access to public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // If no session cookie and trying to access a protected route,
  // redirect to login
  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/v1/webhooks (public webhook endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public assets with file extensions (.svg, .png, .jpg, etc.)
     *
     * /login and /register are matched but handled as public paths
     * in the proxy function body.
     */
    '/((?!api/webhooks|api/deploy|api/route-auth|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
