import type { H3Event } from 'h3'
import { ProspectError, validateProspectInput } from '../services/prospects'

export async function prospectOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw createError({
      statusCode: error instanceof ProspectError ? error.statusCode : 503,
      message: error instanceof ProspectError ? error.message : 'Impossible d’accéder aux prospects. Vérifiez la base de données et les migrations.'
    })
  }
}

export function prospectRouteId(event: H3Event) {
  const id = getRouterParam(event, 'prospectId')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, message: 'L’identifiant est invalide.' })
  }
  return id
}

export async function readProspectInput(event: H3Event) {
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim() !== 'application/json') {
    throw createError({ statusCode: 415, message: 'La requête doit être au format JSON.' })
  }
  const body = await readBody(event).catch(() => {
    throw createError({ statusCode: 400, message: 'La requête JSON est invalide.' })
  })
  return prospectOperation(async () => validateProspectInput(body))
}
