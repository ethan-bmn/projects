import { startDocusignAuthorization } from '../../../services/docusign'

export default defineEventHandler(event => settingsResponse(event, async () => {
  const result = await startDocusignAuthorization(getDatabase(event))
  setCookie(event, 'docusign-state', result.state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/docusign/callback', maxAge: 600
  })
  return { url: result.url }
}))
