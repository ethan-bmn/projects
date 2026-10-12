import postgres from 'postgres'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AbbySyncError, fetchAbbyClients } from '../../server/services/abby-client'
import type { AbbyClient } from '../../server/services/abby-client'
import { syncClients } from '../../server/services/client-sync'
import { createTestDatabase } from '../helpers/database'

const database = await createTestDatabase()
afterAll(database.cleanup)
const config = { apiKey: 'test-only-key', baseUrl: 'https://api.app-abby.com' }
const item: AbbyClient = { id: 'abby-1', kind: 'organization', name: 'Dupont SARL', emails: ['info@example.test'], commercialName: null }

beforeEach(async () => {
  await database.sql`TRUNCATE projects, clients`
  await database.sql`UPDATE abby_sync_state SET last_attempt_at = NULL, last_success_at = NULL, last_error = NULL, client_count = 0`
})

describe('persisted client synchronization', () => {
  it('updates clients without duplicating them or changing their local ID', async () => {
    await syncClients(database.sql, config, { fetchClients: async () => [item] })
    const [first] = await database.sql`SELECT * FROM clients`
    const result = await syncClients(database.sql, config, { fetchClients: async () => [{ ...item, name: 'Martin SAS', commercialName: 'Atelier Martin', emails: [] }] })
    expect(result).toMatchObject({ status: 'success', count: 1 })
    const rows = await database.sql`SELECT * FROM clients`
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: first!.id, name: 'Martin SAS', commercial_name: 'Atelier Martin', emails: [], active: true })
    const [state] = await database.sql`SELECT * FROM abby_sync_state`
    expect(state!.last_success_at).toBeInstanceOf(Date)
    expect(state!.last_error).toBeNull()
  })

  it('retains missing clients and reactivates the same ID when they return', async () => {
    await syncClients(database.sql, config, { fetchClients: async () => [item] })
    const [before] = await database.sql`SELECT * FROM clients`
    await syncClients(database.sql, config, { fetchClients: async () => [] })
    expect((await database.sql`SELECT * FROM clients`)[0]).toMatchObject({ id: before!.id, active: false })
    await syncClients(database.sql, config, { fetchClients: async () => [item] })
    expect((await database.sql`SELECT * FROM clients`)[0]).toMatchObject({ id: before!.id, active: true })
  })

  it('preserves all stored clients and success timestamp if a later page fails', async () => {
    await syncClients(database.sql, config, { fetchClients: async () => [item] })
    const before = await database.sql`SELECT * FROM clients`
    const [state] = await database.sql`SELECT * FROM abby_sync_state`
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ docs: [{ id: 'new', name: 'New client' }], page: 1, hasNextPage: true, nextPage: 2 }))
      .mockResolvedValueOnce(new Response('private upstream error', { status: 500 }))
    expect(await syncClients(database.sql, config, { fetchClients: () => fetchAbbyClients(config, request) })).toMatchObject({ status: 'failed' })
    expect(await database.sql`SELECT * FROM clients`).toEqual(before)
    const [after] = await database.sql`SELECT * FROM abby_sync_state`
    expect(after!.last_success_at).toEqual(state!.last_success_at)
    expect(after!.last_error).toContain('Abby est indisponible')
  })

  it('rolls back a DB write failure instead of leaving a partial import', async () => {
    await syncClients(database.sql, config, { fetchClients: async () => [item] })
    const before = await database.sql`SELECT * FROM clients`
    await expect(syncClients(database.sql, config, {
      fetchClients: async () => [{ ...item, name: 'Changed' }, { ...item, id: 'bad', name: null as unknown as string }]
    })).rejects.toMatchObject({ code: '23502' })
    expect(await database.sql`SELECT * FROM clients`).toEqual(before)
  })

  it('stores both segments with separate identities even when Abby IDs match', async () => {
    const individual: AbbyClient = { ...item, kind: 'individual', name: 'Jean Dupont' }
    await syncClients(database.sql, config, { fetchClients: async () => [item, individual] })
    const before = await database.sql`SELECT id, kind FROM clients ORDER BY kind`
    expect(before).toHaveLength(2)
    expect(before[0]!.id).not.toBe(before[1]!.id)
    await syncClients(database.sql, config, { fetchClients: async () => [item, { ...individual, name: 'Jean Martin' }] })
    expect(await database.sql`SELECT id, kind FROM clients ORDER BY kind`).toEqual(before)
    expect((await database.sql`SELECT name FROM clients WHERE kind = 'individual'`)[0]!.name).toBe('Jean Martin')
    expect((await database.sql`SELECT name FROM clients WHERE kind = 'organization'`)[0]!.name).toBe(item.name)
  })

  it('keeps the individual record inactive when that person joins an organization', async () => {
    const fetchClients = (linked: boolean) => {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ docs: linked ? [{ id: 'org-1', name: 'Company' }] : [], page: 1, hasNextPage: false }))
        .mockResolvedValueOnce(Response.json({ docs: [{ id: 'person-1', fullname: 'Jean', organization: linked ? { id: 'org-1', name: 'Company' } : null }], page: 1, hasNextPage: false }))
      return () => fetchAbbyClients(config, request)
    }
    await syncClients(database.sql, config, { fetchClients: fetchClients(false) })
    const [individual] = await database.sql`SELECT * FROM clients WHERE kind = 'individual'`
    await syncClients(database.sql, config, { fetchClients: fetchClients(true) })
    expect((await database.sql`SELECT * FROM clients WHERE kind = 'individual'`)[0]).toMatchObject({ id: individual!.id, active: false })
    expect((await database.sql`SELECT * FROM clients WHERE active = true`)).toMatchObject([{ abby_id: 'org-1', kind: 'organization' }])
    await syncClients(database.sql, config, { fetchClients: fetchClients(false) })
    expect((await database.sql`SELECT * FROM clients WHERE active = true`)).toMatchObject([{ id: individual!.id, kind: 'individual' }])
  })

  it('preserves both segments if contact retrieval fails after organization retrieval succeeds', async () => {
    await syncClients(database.sql, config, { fetchClients: async () => [item, { ...item, kind: 'individual', name: 'Jean' }] })
    const before = await database.sql`SELECT * FROM clients ORDER BY kind`
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ docs: [{ id: item.id, name: 'Changed company' }], page: 1, hasNextPage: false }))
      .mockResolvedValueOnce(new Response('private upstream error', { status: 500 }))
    expect(await syncClients(database.sql, config, { fetchClients: () => fetchAbbyClients(config, request) })).toMatchObject({ status: 'failed' })
    expect(await database.sql`SELECT * FROM clients ORDER BY kind`).toEqual(before)
  })

  it('skips automatic imports after success, backs off failures, and allows manual retry', async () => {
    const fetchClients = vi.fn(async () => [item])
    await syncClients(database.sql, config, { automatic: true, fetchClients })
    expect(await syncClients(database.sql, config, { automatic: true, fetchClients })).toEqual({ status: 'skipped' })
    expect(fetchClients).toHaveBeenCalledTimes(1)
    await database.sql`UPDATE abby_sync_state SET last_success_at = NULL, last_attempt_at = NULL`
    const failure = vi.fn(async () => {
      throw new AbbySyncError('Abby est indisponible.')
    })
    await syncClients(database.sql, config, { automatic: true, fetchClients: failure })
    expect(await syncClients(database.sql, config, { automatic: true, fetchClients: failure })).toEqual({ status: 'skipped' })
    expect(failure).toHaveBeenCalledTimes(1)
    expect(await syncClients(database.sql, config, { fetchClients })).toMatchObject({ status: 'success' })
  })

  it('prevents overlapping imports across DB connections', async () => {
    const other = postgres(database.url, { max: 1 })
    let release!: () => void
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = syncClients(database.sql, config, { fetchClients: async () => {
      started()
      await blocked
      return [item]
    } })
    try {
      await ready
      expect(await syncClients(other, config, { fetchClients: async () => [] })).toEqual({ status: 'busy' })
    } finally {
      release()
      await first
      await other.end()
    }
  })

  it('replaces the previous schema and clears its sync state', async () => {
    const original = await readFile(new URL('../../database/migrations/003_abby_contacts.sql', import.meta.url), 'utf8')
    const replacement = await readFile(new URL('../../database/migrations/004_abby_clients.sql', import.meta.url), 'utf8')
    await database.sql.begin(async (sql) => {
      await sql`CREATE SCHEMA replacement_test`
      await sql`SET LOCAL search_path TO replacement_test`
      await sql.unsafe(original)
      await sql`INSERT INTO contacts (abby_id, fullname) VALUES ('previous', 'Previous person')`
      await sql`UPDATE abby_sync_state SET last_success_at = now(), last_attempt_at = now(), last_error = 'old failure', contact_count = 1`
      await sql.unsafe(replacement)
      const [removed] = await sql`SELECT to_regclass('replacement_test.contacts') AS name`
      expect(removed!.name).toBeNull()
      expect(await sql`SELECT * FROM clients`).toHaveLength(0)
      const [state] = await sql`SELECT * FROM abby_sync_state`
      expect(state).toMatchObject({ last_success_at: null, last_attempt_at: null, last_error: null, client_count: 0 })
      await sql`DROP SCHEMA replacement_test CASCADE`
    })
  })

  it('adds segmentation to existing organizations without changing local IDs', async () => {
    const original = await readFile(new URL('../../database/migrations/003_abby_contacts.sql', import.meta.url), 'utf8')
    const replacement = await readFile(new URL('../../database/migrations/004_abby_clients.sql', import.meta.url), 'utf8')
    const segmentation = await readFile(new URL('../../database/migrations/005_client_segmentation.sql', import.meta.url), 'utf8')
    await database.sql.begin(async (sql) => {
      await sql`CREATE SCHEMA segmentation_test`
      await sql`SET LOCAL search_path TO segmentation_test`
      await sql.unsafe(original)
      await sql.unsafe(replacement)
      await sql`INSERT INTO clients (abby_id, name) VALUES ('same-id', 'Existing company')`
      const [before] = await sql`SELECT * FROM clients`
      await sql.unsafe(segmentation)
      expect((await sql`SELECT * FROM clients`)[0]).toEqual({ ...before, kind: 'organization' })
      await sql`INSERT INTO clients (kind, abby_id, name) VALUES ('individual', 'same-id', 'Jean')`
      expect(await sql`SELECT * FROM clients`).toHaveLength(2)
      await sql`DROP SCHEMA segmentation_test CASCADE`
    })
  })
})
