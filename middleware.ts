import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const creatorMode = request.nextUrl.searchParams.get('creator_mode')

  if (creatorMode === '1') {
    response.cookies.set('soon_creator_mode', '1', { path: '/', sameSite: 'lax' })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
