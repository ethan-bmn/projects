export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return

  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method)) {
    const origin = getHeader(event, 'origin')
    if (origin && origin !== getRequestURL(event).origin) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Accès refusé.' })
    }
  }

  const isLogin = path === '/api/auth/login' && event.method === 'POST'
  const isSession = path === '/api/_auth/session' && ['GET', 'DELETE'].includes(event.method)
  // OAuth returns cross-site: the callback validates its own expiring, single-use
  // state and an HttpOnly SameSite=Lax cookie instead of the Strict session cookie.
  const isDocusignCallback = path === '/api/docusign/callback' && event.method === 'GET'
  if (isLogin || isSession || isDocusignCallback) return

  await requireOwnerSession(event)
})
