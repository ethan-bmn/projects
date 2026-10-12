import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProject, getClientProjects, getProject, updateProject } from '../../server/services/projects'
import { syncClients } from '../../server/services/client-sync'
import { createTestDatabase } from '../helpers/database'
import { projectInput } from '../helpers/projects'

const database = await createTestDatabase()
afterAll(database.cleanup)
let businessId: string
let individualId: string

beforeEach(async () => {
  await database.sql`TRUNCATE projects, clients`
  const rows = await database.sql`
    INSERT INTO clients (kind, abby_id, name)
    VALUES ('organization', 'company', 'Atelier Dupont'), ('individual', 'person', 'Marie Durand') RETURNING id, kind
  `
  businessId = rows.find(row => row.kind === 'organization')!.id
  individualId = rows.find(row => row.kind === 'individual')!.id
})

describe('customer projects', () => {
  it('stores multiple independent projects for one customer and keeps customer lists separate', async () => {
    const first = await createProject(database.sql, businessId, projectInput('Site web'))
    const second = await createProject(database.sql, businessId, projectInput('Application mobile'))
    const third = await createProject(database.sql, individualId, projectInput('Portfolio'))
    expect(first.id).not.toBe(second.id)
    expect((await getClientProjects(database.sql, businessId)).projects.map(item => item.id)).toEqual(expect.arrayContaining([first.id, second.id]))
    expect((await getClientProjects(database.sql, businessId)).projects).toHaveLength(2)
    expect((await getClientProjects(database.sql, individualId)).projects.map(item => item.id)).toEqual([third.id])
    expect((await getProject(database.sql, businessId, first.id)).project.specification).toEqual(projectInput().specification)
  })

  it('updates one project without changing its customer or neighboring projects', async () => {
    const first = await createProject(database.sql, businessId, projectInput())
    const second = await createProject(database.sql, businessId, projectInput('Autre projet'))
    const input = projectInput('Nouveau nom')
    input.specification.databaseArchitecture = 'Modèle relationnel.'
    input.specification.schedule = 'Phase 1\nPhase 2'
    const updated = await updateProject(database.sql, businessId, first.id, input)
    expect(updated).toMatchObject({ id: first.id, clientId: businessId, name: input.name, specification: input.specification, createdAt: first.createdAt })
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(first.updatedAt))
    expect((await getProject(database.sql, businessId, second.id)).project).toEqual(second)
  })

  it('rejects viewing or modifying a project under the wrong customer', async () => {
    const first = await createProject(database.sql, businessId, projectInput())
    await expect(getProject(database.sql, individualId, first.id)).rejects.toMatchObject({ statusCode: 404 })
    await expect(updateProject(database.sql, individualId, first.id, projectInput('Wrong customer'))).rejects.toMatchObject({ statusCode: 404 })
    expect((await getProject(database.sql, businessId, first.id)).project.name).toBe(first.name)
  })

  it('enforces the customer foreign key and prevents deletion of a customer with projects', async () => {
    await createProject(database.sql, businessId, projectInput())
    await expect(database.sql`DELETE FROM clients WHERE id = ${businessId}`).rejects.toMatchObject({ code: '23001' })
    await expect(database.sql`
      INSERT INTO projects (client_id, name, specification) VALUES ('00000000-0000-0000-0000-000000000000', 'Orphan', '{}')
    `).rejects.toMatchObject({ code: '23503' })
    await expect(createProject(database.sql, '00000000-0000-0000-0000-000000000000', projectInput())).rejects.toMatchObject({ statusCode: 404 })
  })

  it('preserves project contents and access when Abby updates or deactivates the customer', async () => {
    const first = await createProject(database.sql, businessId, projectInput())
    const config = { apiKey: 'test-only', baseUrl: 'https://api.app-abby.com' }
    await syncClients(database.sql, config, { fetchClients: async () => [{ id: 'company', kind: 'organization', name: 'Renamed company', emails: [], commercialName: null }] })
    expect((await getProject(database.sql, businessId, first.id)).project).toEqual(first)
    await syncClients(database.sql, config, { fetchClients: async () => [] })
    const detail = await getProject(database.sql, businessId, first.id)
    expect(detail.client.active).toBe(false)
    expect(detail.project).toEqual(first)
    expect((await getClientProjects(database.sql, businessId)).projects).toHaveLength(1)
  })
})
