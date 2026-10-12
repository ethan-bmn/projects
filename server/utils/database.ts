import postgres from 'postgres'
import type { H3Event } from 'h3'

let database: postgres.Sql | undefined

export function getDatabase(event?: H3Event) {
  if (!database) {
    const url = useRuntimeConfig(event).databaseUrl || process.env.DATABASE_URL
    if (!url) throw createError({ statusCode: 503, statusMessage: 'Database is not configured', message: 'La base de données n’est pas configurée.' })
    database = postgres(url, { max: 5, connect_timeout: 10, idle_timeout: 20 })
  }
  return database
}

export async function closeDatabase() {
  await database?.end()
  database = undefined
}

export async function getOwnerAccount(event: H3Event) {
  try {
    const [owner] = await getDatabase(event)<{ id: number, email: string, password_hash: string }[]>`
      SELECT id, email, password_hash FROM "user" WHERE id = 1
    `
    return owner
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Owner database is unavailable', message: 'La base de données est indisponible.' })
  }
}
