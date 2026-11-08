import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth/server'

const handler = auth.handler()

type RouteContext = { params: Promise<{ path: string[] }> }

function withOriginLogging(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') {
  return async (request: NextRequest, context: RouteContext) => {
    const response = await handler[method](request, context)
    if (response.status === 403) {
      console.log(
        '[v0] auth request rejected',
        request.nextUrl.pathname,
        'origin:',
        request.headers.get('origin'),
        'host:',
        request.headers.get('host'),
      )
    }
    return response
  }
}

export const GET = withOriginLogging('GET')
export const POST = withOriginLogging('POST')
export const PUT = withOriginLogging('PUT')
export const PATCH = withOriginLogging('PATCH')
export const DELETE = withOriginLogging('DELETE')
