import type postgres from 'postgres'
import { AbbySyncError, fetchAbbyClients } from './abby-client'
import type { AbbyConfig, AbbyClient } from './abby-client'

const day = 24 * 60 * 60_000
const hour = 60 * 60_000

export function syncIsDue(lastSuccess: Date | null, lastAttempt: Date | null, now = Date.now()) {
  return (!lastSuccess || now - lastSuccess.getTime() >= day)
    && (!lastAttempt || now - lastAttempt.getTime() >= hour)
}

export async function syncClients(
  sql: postgres.Sql,
  config: AbbyConfig,
  options: { automatic?: boolean, fetchClients?: (config: AbbyConfig) => Promise<AbbyClient[]> } = {}
) {
  // A transaction-level lock works across instances and is released on crashes.
  return sql.begin(async (transaction) => {
    const [lock] = await transaction`SELECT pg_try_advisory_xact_lock(748249156) AS acquired`
    if (!lock!.acquired) return { status: 'busy' as const }
    const [state] = await transaction`SELECT * FROM abby_sync_state WHERE id = 1`
    if (!state) throw new AbbySyncError('Appliquez les migrations avant de synchroniser les clients.', 503)
    if (options.automatic && !syncIsDue(state.last_success_at, state.last_attempt_at)) {
      return { status: 'skipped' as const }
    }

    const attemptedAt = new Date()
    let clients: AbbyClient[]
    try {
      // Finish every page before changing stored clients.
      clients = await (options.fetchClients ?? fetchAbbyClients)(config)
    } catch (error) {
      const safeError = error instanceof AbbySyncError ? error : new AbbySyncError('La synchronisation Abby a échoué.')
      await transaction`
        UPDATE abby_sync_state SET last_attempt_at = ${attemptedAt}, last_error = ${safeError.message} WHERE id = 1
      `
      return { status: 'failed' as const, message: safeError.message, statusCode: safeError.statusCode }
    }

    const syncedAt = new Date()
    // Missing or archived clients stay available for future project relations.
    await transaction`UPDATE clients SET active = false WHERE active = true`
    for (const item of clients) {
      await transaction`
        INSERT INTO clients (kind, abby_id, name, emails, commercial_name, billing_address, synced_at)
        VALUES (${item.kind}, ${item.id}, ${item.name}, ${item.emails}, ${item.commercialName}, ${item.billingAddress ? transaction.json(item.billingAddress) : null}, ${syncedAt})
        ON CONFLICT (kind, abby_id) DO UPDATE SET
          name = EXCLUDED.name,
          emails = EXCLUDED.emails,
          commercial_name = EXCLUDED.commercial_name,
          billing_address = EXCLUDED.billing_address,
          active = true,
          updated_at = now(),
          synced_at = EXCLUDED.synced_at
      `
    }
    await transaction`
      UPDATE abby_sync_state SET last_attempt_at = ${attemptedAt}, last_success_at = ${syncedAt},
        last_error = NULL, client_count = ${clients.length} WHERE id = 1
    `
    return { status: 'success' as const, count: clients.length, syncedAt: syncedAt.toISOString() }
  })
}
