import type { H3Event } from 'h3'
import { SettingsError } from '../services/settings'

export async function settingsResponse<T>(event: H3Event, action: () => Promise<T>): Promise<T> {
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    return await action()
  } catch (error) {
    throw createError({
      statusCode: error instanceof SettingsError ? error.statusCode : 503,
      message: error instanceof SettingsError ? error.message : 'Impossible de modifier ou de charger les paramètres. Réessayez plus tard.'
    })
  }
}

export async function readSettingsBody(event: H3Event) {
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim() !== 'application/json') {
    throw new SettingsError('La requête doit être au format JSON.', 415)
  }
  try {
    return await readBody(event)
  } catch {
    throw new SettingsError('Les paramètres sont invalides.')
  }
}
