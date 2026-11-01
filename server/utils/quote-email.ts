import type { H3Event } from 'h3'
import { AbbySyncError } from '../services/abby-client'
import { ProjectError } from '../services/projects'
import { SettingsError } from '../services/settings'

export async function quoteEmailOperation<T>(event: H3Event, operation: () => Promise<T>) {
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    return await operation()
  } catch (error) {
    const known = error instanceof SettingsError || error instanceof ProjectError || error instanceof AbbySyncError
    throw createError({ statusCode: known ? error.statusCode : 503, message: known ? error.message : 'Impossible de traiter l’envoi du devis. Réessayez après vérification de l’historique.' })
  }
}
