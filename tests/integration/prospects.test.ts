import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProspect, deleteProspect, listProspects, updateProspect } from '../../server/services/prospects'
import { syncClients } from '../../server/services/client-sync'
import { createTestDatabase } from '../helpers/database'

const database = await createTestDatabase()
afterAll(database.cleanup)
const input = { name: 'Atelier Martin', domain: 'Artisanat', email: '', phone: '+33 6 12 34 56 78', websiteUrl: null }

beforeEach(async () => {
  await database.sql`TRUNCATE prospects`
})

describe('database-only prospects', () => {
  it('persists, edits, and deletes prospects independently from Abby clients', async () => {
    const created = await createProspect(database.sql, input)
    expect(created).toMatchObject(input)
    await syncClients(database.sql, { apiKey: 'test-only', baseUrl: 'https://example.test' }, { fetchClients: async () => [] })
    expect((await listProspects(database.sql)).prospects).toEqual([created])
    const updated = await updateProspect(database.sql, created.id, { ...input, email: 'hello@example.fr', websiteUrl: 'https://example.fr' })
    expect(updated).toMatchObject({ id: created.id, createdAt: created.createdAt, email: 'hello@example.fr', websiteUrl: 'https://example.fr' })
    expect((await database.sql`SELECT count(*)::integer AS count FROM clients`)[0]!.count).toBe(0)
    await updateProspect(database.sql, created.id, input)
    expect((await listProspects(database.sql)).prospects[0]!.websiteUrl).toBeNull()
    await deleteProspect(database.sql, created.id)
    expect((await listProspects(database.sql)).total).toBe(0)
    await expect(updateProspect(database.sql, created.id, input)).rejects.toMatchObject({ statusCode: 404 })
    await expect(deleteProspect(database.sql, created.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('paginates and searches contact details and domain as literal text', async () => {
    for (let index = 0; index < 51; index++) {
      await createProspect(database.sql, { ...input, name: `Prospect ${String(index).padStart(2, '0')}` })
    }
    const first = await listProspects(database.sql)
    const second = await listProspects(database.sql, 2)
    expect(first).toMatchObject({ total: 51, page: 1, pageSize: 50 })
    expect(first.prospects).toHaveLength(50)
    expect(second.prospects).toHaveLength(1)
    expect(second.prospects[0]!.name).toBe('Prospect 50')
    expect((await listProspects(database.sql, 1, 'artisanat')).total).toBe(51)
    expect((await listProspects(database.sql, 1, '+33')).total).toBe(51)
    expect((await listProspects(database.sql, 1, '%')).total).toBe(0)
    await createProspect(database.sql, { ...input, email: 'literal_%@example.fr' })
    expect((await listProspects(database.sql, 1, 'literal_%')).total).toBe(1)
  })
})
