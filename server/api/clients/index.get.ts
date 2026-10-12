import type { ClientList } from '../../../shared/types/clients'

export default defineEventHandler(async (event): Promise<ClientList> => {
  setHeader(event, 'Cache-Control', 'no-store')
  const query = getQuery(event)
  const page = Number(query.page ?? 1)
  const kind = query.kind ?? 'all'
  const pageSize = 50
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) {
    throw createError({ statusCode: 400, message: 'Le numéro de page est invalide.' })
  }
  if (!['all', 'organization', 'individual'].includes(kind as string)) {
    throw createError({ statusCode: 400, message: 'Le type de client est invalide.' })
  }
  return getDatabase(event).begin(async (sql) => {
    const clients = await sql`
      SELECT id, abby_id, kind, name, emails, commercial_name FROM clients
      WHERE active = true AND (${kind === 'all'} OR kind = ${String(kind)})
      ORDER BY name, id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `
    const [count] = await sql`
      SELECT count(*)::integer AS total FROM clients
      WHERE active = true AND (${kind === 'all'} OR kind = ${String(kind)})
    `
    const [state] = await sql`SELECT last_success_at, last_attempt_at, last_error FROM abby_sync_state WHERE id = 1`
    return {
      clients: clients.map(item => ({
        id: item.id,
        abbyId: item.abby_id,
        kind: item.kind,
        name: item.name,
        emails: item.emails,
        commercialName: item.commercial_name
      })),
      total: count!.total,
      page,
      pageSize,
      sync: {
        configured: Boolean(getAbbyConfig(event).apiKey.trim()),
        lastSuccessAt: state?.last_success_at?.toISOString() ?? null,
        lastAttemptAt: state?.last_attempt_at?.toISOString() ?? null,
        lastError: state?.last_error ?? null
      }
    }
  }).catch(() => {
    throw createError({ statusCode: 503, message: 'Impossible de charger les clients. Vérifiez la base de données et les migrations.' })
  })
})
