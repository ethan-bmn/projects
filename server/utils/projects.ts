import type { H3Event } from 'h3'
import { ProjectError, validateProjectInput } from '../services/projects'

export function projectRouteId(event: H3Event, name: 'clientId' | 'projectId') {
  const id = getRouterParam(event, name)
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, message: 'L’identifiant est invalide.' })
  }
  return id
}

export async function projectOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw createError({
      statusCode: error instanceof ProjectError ? error.statusCode : 503,
      message: error instanceof ProjectError ? error.message : 'Impossible d’accéder aux projets. Vérifiez la base de données et les migrations.'
    })
  }
}

export async function readProjectInput(event: H3Event) {
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim() !== 'application/json') {
    throw createError({ statusCode: 415, message: 'La requête doit être au format JSON.' })
  }
  const body = await readBody(event).catch(() => {
    throw createError({ statusCode: 400, message: 'La requête JSON est invalide.' })
  })
  return projectOperation(async () => validateProjectInput(body))
}
