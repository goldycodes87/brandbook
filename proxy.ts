import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/offline',
]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic =
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/invite/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/vet/') ||
    pathname.startsWith('/owner/') ||
    pathname.startsWith('/landowner/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icon') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/workbox-')

  if (isPublic) return NextResponse.next()

  const session = req.cookies.get('brandbook_session')
  if (session?.value !== 'authenticated') {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
