import { completeDocusignAuthorization } from '../../services/docusign'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  const query = getQuery(event)
  const cookie = getCookie(event, 'docusign-state')
  deleteCookie(event, 'docusign-state', { path: '/api/docusign/callback' })
  if (typeof query.state !== 'string' || !cookie || cookie !== query.state || typeof query.code !== 'string') {
    return sendRedirect(event, '/settings?docusign=error#docusign')
  }
  try {
    await completeDocusignAuthorization(getDatabase(event), query.code, query.state, process.env.NUXT_SESSION_PASSWORD || '')
    return sendRedirect(event, '/settings?docusign=connected#docusign')
  } catch {
    return sendRedirect(event, '/settings?docusign=error#docusign')
  }
})
