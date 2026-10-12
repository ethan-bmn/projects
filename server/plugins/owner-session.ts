export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', closeDatabase)
  sessionHooks.hook('fetch', async (session, event) => {
    if (session.user && !await isOwnerSession(event, session)) {
      await clearUserSession(event)
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Votre session a expiré. Reconnectez-vous.' })
    }
  })
})
