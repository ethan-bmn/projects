import { syncClients } from '../../services/client-sync'
import { AbbySyncError } from '../../services/abby-client'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const result = await getAbbyConfig(event)
    .then(config => syncClients(getDatabase(event), config))
    .catch((error) => {
      throw createError({
        statusCode: error instanceof AbbySyncError ? error.statusCode : 503,
        message: error instanceof AbbySyncError ? error.message : 'La synchronisation est indisponible. Vérifiez la base de données et les migrations.'
      })
    })
  if (result.status === 'busy') {
    throw createError({ statusCode: 409, message: 'Une synchronisation est déjà en cours. Réessayez dans un instant.' })
  }
  if (result.status === 'failed') {
    throw createError({ statusCode: result.statusCode, message: result.message })
  }
  return result
})
