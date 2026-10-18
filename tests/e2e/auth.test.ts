import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'
import { migrateDatabase, ownerSeedCredentials, seedOwner } from '../../database/setup'
import { createTestDatabase } from '../helpers/database'
import { projectInput } from '../helpers/projects'
import { projectDiagrams } from '../helpers/diagrams'
import { auditContract, fullContract } from '../helpers/contracts'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

let svgStatus = 200
let svgBody = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text>clients</text></svg>'
let svgSource = ''
const svgWorker = createServer(async (request, response) => {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  svgSource = JSON.parse(Buffer.concat(chunks).toString()).source
  response.writeHead(svgStatus, { 'Content-Type': 'image/svg+xml' }).end(svgBody)
})
await new Promise<void>(resolve => svgWorker.listen(0, '127.0.0.1', resolve))
afterAll(() => new Promise<void>((resolve, reject) => svgWorker.close(error => error ? reject(error) : resolve())))

const email = 'owner@example.test'
const password = 'test-owner-password-only'
const hash = await new Scrypt({}).make(password)
const database = await createTestDatabase()
afterAll(database.cleanup)
await seedOwner(database.sql, { email, hash })

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  browser: false,
  setupTimeout: 240_000,
  env: {
    NUXT_DATABASE_URL: database.url,
    DATABASE_URL: database.url,
    NUXT_ABBY_API_KEY: 'unused-environment-key',
    NUXT_CHARTDB_EXPORT_URL: `http://127.0.0.1:${(svgWorker.address() as AddressInfo).port}`,
    // These differ deliberately: runtime environment credentials must not bypass the DB.
    NUXT_OWNER_EMAIL: 'not-the-owner@example.test',
    NUXT_OWNER_PASSWORD_HASH: await new Scrypt({}).make('unused-environment-password'),
    NUXT_SESSION_PASSWORD: 'test-session-secret-at-least-32-characters'
  },
  nuxtConfig: {
    devtools: { enabled: false },
    fonts: {
      providers: {
        google: false,
        googleicons: false,
        bunny: false,
        fontshare: false,
        fontsource: false
      }
    }
  }
})

async function login(body = { email, password }) {
  return fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

function sessionCookie(response: Response) {
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('nuxt-session=') && !value.startsWith('nuxt-session=;'))
  expect(cookie).toBeDefined()
  expect(cookie).toContain('HttpOnly')
  expect(cookie).toContain('SameSite=Strict')
  return cookie!.split(';')[0]!
}

describe('owner authentication', () => {
  it('exports saved ChartDB schemas as SVG through protected customer-scoped routes', async () => {
    const cookie = sessionCookie(await login())
    const [customer] = await database.sql`INSERT INTO clients (kind, abby_id, name) VALUES ('individual', 'svg-export-person', 'SVG person') RETURNING id`
    const headers = { cookie, 'Content-Type': 'application/json' }
    const input = { ...projectInput('Été : architecture'), diagrams: projectDiagrams() }
    try {
      const created = await (await fetch(`/api/clients/${customer!.id}/projects`, { method: 'POST', headers, body: JSON.stringify(input) })).json()
      const url = `/api/clients/${customer!.id}/projects/${created.id}/database.svg`
      expect((await fetch(url, { method: 'POST' })).status).toBe(401)
      expect((await fetch(url, { method: 'POST', headers: { ...headers, Origin: 'https://other.example.test' } })).status).toBe(403)
      expect((await fetch(`/api/clients/00000000-0000-0000-0000-000000000000/projects/${created.id}/database.svg`, { method: 'POST', headers })).status).toBe(404)
      const response = await fetch(url, { method: 'POST', headers })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('image/svg+xml')
      expect(response.headers.get('content-disposition')).toBe('attachment; filename="architecture-db-ete-architecture.svg"')
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.text()).toBe(svgBody)
      expect(svgSource).toBe(input.diagrams.database)
      svgStatus = 429
      expect((await fetch(url, { method: 'POST', headers })).status).toBe(429)
      svgStatus = 503
      expect((await fetch(url, { method: 'POST', headers })).status).toBe(503)
      svgStatus = 200
      svgBody = '<html>invalid renderer response</html>'
      expect((await fetch(url, { method: 'POST', headers })).status).toBe(503)
      await fetch(`/api/clients/${customer!.id}/projects/${created.id}`, { method: 'PUT', headers, body: JSON.stringify({ ...input, diagrams: { database: null, wbs: [] } }) })
      expect((await fetch(url, { method: 'POST', headers })).status).toBe(400)
    } finally {
      svgStatus = 200
      svgBody = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text>clients</text></svg>'
      await database.sql`DELETE FROM projects WHERE client_id = ${customer!.id}`
      await database.sql`DELETE FROM clients WHERE id = ${customer!.id}`
    }
  })

  it('renames the original account table without changing the stored account', async () => {
    const original = await readFile(new URL('../../database/migrations/001_users.sql', import.meta.url), 'utf8')
    const rename = await readFile(new URL('../../database/migrations/002_user_table.sql', import.meta.url), 'utf8')
    await database.sql.begin(async (transaction) => {
      await transaction`CREATE SCHEMA migration_rename_test`
      await transaction`SET LOCAL search_path TO migration_rename_test`
      await transaction.unsafe(original)
      await transaction`INSERT INTO users (id, email, password_hash) VALUES (1, ${email}, ${hash})`
      const [before] = await transaction`SELECT * FROM users`
      await transaction.unsafe(rename)
      const [after] = await transaction`SELECT * FROM "user"`
      expect(after).toEqual(before)
      const [oldTable] = await transaction`SELECT to_regclass('migration_rename_test.users') AS name`
      expect(oldTable!.name).toBeNull()
      await transaction`DROP SCHEMA migration_rename_test CASCADE`
    })
  })

  it('applies migrations and reseeds idempotently with exactly one account', async () => {
    const [before] = await database.sql`SELECT * FROM "user"`
    await migrateDatabase(database.sql)
    await seedOwner(database.sql, { email, hash })
    const rows = await database.sql`SELECT * FROM "user"`
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(before)
    await expect(database.sql`
      INSERT INTO "user" (id, email, password_hash) VALUES (2, 'second@example.test', ${hash})
    `).rejects.toMatchObject({ code: '23514' })
  })

  it('hashes a plaintext seed password and preserves the hash when reseeded', async () => {
    const credentials = await ownerSeedCredentials({ NUXT_OWNER_EMAIL: email, NUXT_OWNER_PASSWORD: password })
    await seedOwner(database.sql, credentials)
    const [owner] = await database.sql`SELECT password_hash FROM "user"`
    expect(owner!.password_hash).not.toBe(password)
    expect(await new Scrypt({}).verify(owner!.password_hash, password)).toBe(true)
    await seedOwner(database.sql, await ownerSeedCredentials({ NUXT_OWNER_EMAIL: email, NUXT_OWNER_PASSWORD: password }))
    const [reseeded] = await database.sql`SELECT password_hash FROM "user"`
    expect(reseeded!.password_hash).toBe(owner!.password_hash)
  })

  it('serves the auth form without a session', async () => {
    const response = await fetch('/auth')
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Connexion')
    expect(html).toContain('autocomplete="current-password"')
  })

  it('redirects direct index requests to auth before rendering private content', async () => {
    const response = await fetch('/', { redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/auth')
    expect(await response.text()).not.toContain('Nuxt Starter Template')
  })

  it('rejects incorrect passwords and other account emails', async () => {
    expect((await login({ email, password: 'incorrect-password' })).status).toBe(401)
    expect((await login({ email: 'other@example.test', password })).status).toBe(401)
  })

  it('logs in the owner and redirects auth to index', async () => {
    const response = await login()
    expect(response.status).toBe(200)
    const cookie = sessionCookie(response)
    const index = await fetch('/', { headers: { cookie }, redirect: 'manual' })
    expect(index.status).toBe(200)
    const auth = await fetch('/auth', { headers: { cookie }, redirect: 'manual' })
    expect(auth.status).toBe(302)
    expect(auth.headers.get('location')).toBe('/')
    const session = await fetch('/api/_auth/session', { headers: { cookie } })
    const data = await session.json()
    expect(data.user).toEqual({ id: 'owner', email })
    expect(data.secure).toBeUndefined()
  })

  it('rejects tampered session cookies', async () => {
    const response = await fetch('/', {
      headers: { cookie: 'nuxt-session=forged-owner-session' },
      redirect: 'manual'
    })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/auth')
  })

  it('protects API routes from unauthenticated requests', async () => {
    expect((await fetch('/api/private')).status).toBe(401)
    expect((await fetch('/api/clients')).status).toBe(401)
    expect((await fetch('/api/clients/sync', { method: 'POST' })).status).toBe(401)
  })

  it('lists clients from the DB without exposing Abby credentials', async () => {
    const cookie = sessionCookie(await login())
    await database.sql`INSERT INTO clients (abby_id, name, emails) VALUES ('http-test', 'Jean Dupont', ARRAY['jean@example.test'])`
    try {
      const response = await fetch('/api/clients', { headers: { cookie } })
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      const result = await response.json()
      expect(result.clients).toMatchObject([{ abbyId: 'http-test', name: 'Jean Dupont', emails: ['jean@example.test'] }])
      expect(result.total).toBe(1)
      expect(result.sync.configured).toBe(false)
      expect(result.sync.apiKey).toBeUndefined()
      expect((await fetch('/api/clients?page=0', { headers: { cookie } })).status).toBe(400)
    } finally {
      await database.sql`DELETE FROM clients WHERE abby_id = 'http-test'`
    }
  })

  it('reads Abby connection status from the DB immediately without disclosing the key', async () => {
    const cookie = sessionCookie(await login())
    const apiKey = 'private-database-abby-key'
    try {
      await database.sql`UPDATE abby_settings SET api_key = ${apiKey} WHERE id = 1`
      const response = await fetch('/api/clients', { headers: { cookie } })
      expect(response.status).toBe(200)
      const body = await response.text()
      expect(JSON.parse(body).sync.configured).toBe(true)
      expect(body).not.toContain(apiKey)
      expect(body).not.toContain('unused-environment-key')
      await database.sql`UPDATE abby_settings SET api_key = '' WHERE id = 1`
      const cleared = await fetch('/api/clients', { headers: { cookie } })
      expect((await cleared.json()).sync.configured).toBe(false)
    } finally {
      await database.sql`UPDATE abby_settings SET api_key = '' WHERE id = 1`
    }
  })

  it('protects manual sync and reports missing configuration in French', async () => {
    const cookie = sessionCookie(await login())
    expect((await fetch('/api/clients/sync', {
      method: 'POST', headers: { cookie, Origin: 'https://other.example.test' }
    })).status).toBe(403)
    const response = await fetch('/api/clients/sync', { method: 'POST', headers: { cookie } })
    expect(response.status).toBe(503)
    expect((await response.json()).message).toContain('clé API Abby')
  })

  it('filters and paginates business and individual clients with matching totals', async () => {
    const cookie = sessionCookie(await login())
    await database.sql`
      INSERT INTO clients (kind, abby_id, name)
      SELECT 'organization', 'filter-org-' || n, 'Company ' || lpad(n::text, 2, '0')
      FROM generate_series(1, 51) AS n
    `
    await database.sql`
      INSERT INTO clients (kind, abby_id, name, active)
      VALUES ('individual', 'filter-org-1', 'Jean Dupont', true),
        ('individual', 'filter-inactive', 'Inactive person', false)
    `
    try {
      const all = await (await fetch('/api/clients', { headers: { cookie } })).json()
      expect(all.total).toBe(52)
      expect(all.clients).toHaveLength(50)
      const businesses = await (await fetch('/api/clients?kind=organization&page=2', { headers: { cookie } })).json()
      expect(businesses.total).toBe(51)
      expect(businesses.clients).toMatchObject([{ kind: 'organization', name: 'Company 51' }])
      const individuals = await (await fetch('/api/clients?kind=individual', { headers: { cookie } })).json()
      expect(individuals.total).toBe(1)
      expect(individuals.clients).toMatchObject([{ kind: 'individual', name: 'Jean Dupont' }])
      expect((await fetch('/api/clients?kind=invalid', { headers: { cookie } })).status).toBe(400)
      expect((await fetch('/api/clients?kind=individual&kind=organization', { headers: { cookie } })).status).toBe(400)
    } finally {
      await database.sql`DELETE FROM clients WHERE abby_id LIKE 'filter-%'`
    }
  })

  it('creates and edits customer projects through protected, customer-scoped routes', async () => {
    const cookie = sessionCookie(await login())
    const customers = await database.sql`
      INSERT INTO clients (kind, abby_id, name)
      VALUES ('organization', 'project-http-business', 'HTTP company'), ('individual', 'project-http-person', 'HTTP person')
      RETURNING id, kind
    `
    const clientId = customers.find(item => item.kind === 'organization')!.id
    const otherId = customers.find(item => item.kind === 'individual')!.id
    const url = `/api/clients/${clientId}/projects`
    const headers = { cookie, 'Content-Type': 'application/json' }
    try {
      expect((await fetch(url, { method: 'POST', body: JSON.stringify(projectInput()), headers: { 'Content-Type': 'application/json' } })).status).toBe(401)
      expect((await fetch(url, { method: 'POST', headers: { ...headers, Origin: 'https://other.example.test' }, body: JSON.stringify(projectInput()) })).status).toBe(403)
      expect((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ name: 'Missing specification' }) })).status).toBe(400)
      expect((await fetch(url, { method: 'POST', headers: { cookie, 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(415)
      expect((await fetch('/api/clients/not-a-uuid', { headers: { cookie } })).status).toBe(400)

      const withoutOptionalSections = projectInput()
      withoutOptionalSections.specification.businessContext = null
      withoutOptionalSections.specification.technicalContext = null
      withoutOptionalSections.specification.technicalConstraints = null
      withoutOptionalSections.specification.schedule = null
      const created = await fetch(url, { method: 'POST', headers, body: JSON.stringify(withoutOptionalSections) })
      expect(created.status).toBe(201)
      expect(created.headers.get('cache-control')).toBe('no-store')
      const first = await created.json()
      expect(first.clientId).toBe(clientId)
      expect(first.specification.databaseArchitecture).toBeNull()
      expect(first.specification).toEqual(withoutOptionalSections.specification)
      expect((await fetch(url, { method: 'POST', headers, body: JSON.stringify(projectInput('Deuxième projet')) })).status).toBe(201)
      const customer = await (await fetch(`/api/clients/${clientId}`, { headers: { cookie } })).json()
      expect(customer.projects).toHaveLength(2)
      expect((await fetch(`${url}/${first.id}`, { headers: { cookie } })).status).toBe(200)
      expect((await fetch(`${url}/${first.id}`)).status).toBe(401)
      expect((await fetch(`/api/clients/${otherId}/projects/${first.id}`, { headers: { cookie } })).status).toBe(404)
      expect((await fetch(`/api/clients/${otherId}/projects/${first.id}`, { method: 'PUT', headers, body: JSON.stringify(projectInput('Wrong customer')) })).status).toBe(404)

      const input = projectInput('Projet modifié')
      input.specification.schedule = 'Nouveau planning\nSemaine 5 : livraison'
      input.specification.databaseArchitecture = 'PostgreSQL : modèle relationnel.'
      const updated = await fetch(`${url}/${first.id}`, { method: 'PUT', headers, body: JSON.stringify(input) })
      expect(updated.status).toBe(200)
      expect((await updated.json()).specification).toEqual(input.specification)
      const persisted = await (await fetch(`${url}/${first.id}`, { headers: { cookie } })).json()
      expect(persisted.project.name).toBe(input.name)
      const page = await fetch(`/clients/${clientId}/projects/${first.id}`, { headers: { cookie } })
      expect(page.status).toBe(200)
      const html = await page.text()
      expect(html).toContain('Cahier des charges')
      expect(html).toContain('Exporter en PDF')
      const contractPath = `/clients/${clientId}/projects/${first.id}/contract`
      expect(html).toContain(`href="${contractPath}"`)
      expect(html).not.toContain('Enregistrer le contrat')
      const contractPage = await fetch(contractPath, { headers: { cookie } })
      expect(contractPage.status).toBe(200)
      const contractHtml = await contractPage.text()
      expect(contractHtml).toContain('Enregistrer le contrat')
      expect(contractHtml).toContain('Retour au projet')
      expect(contractHtml).toContain('Services commandés au devis')
      expect(contractHtml).toContain('Traitement de données pour le compte du client')
      expect(contractHtml).not.toContain('Politique complète de rétention')
      const configured = fullContract()
      const savedContract = await fetch(`${url}/${first.id}`, { method: 'PUT', headers, body: JSON.stringify({ ...input, contract: configured }) })
      expect(savedContract.status).toBe(200)
      expect((await savedContract.json()).contract).toEqual(configured)
      const configuredHtml = await (await fetch(contractPath, { headers: { cookie } })).text()
      expect(configuredHtml).toContain('Politique complète de rétention')
      expect(configuredHtml).toContain('Sous-traitants ultérieurs, autorisations')
      const simplified = auditContract()
      expect((await fetch(`${url}/${first.id}`, { method: 'PUT', headers, body: JSON.stringify({ ...input, contract: simplified }) })).status).toBe(200)
      const simpleHtml = await (await fetch(contractPath, { headers: { cookie } })).text()
      expect(simpleHtml).not.toContain('Politique complète de rétention')
      expect(simpleHtml).not.toContain('Sous-traitants ultérieurs, autorisations')
      expect((await fetch(`/clients/${otherId}/projects/${first.id}/contract`, { headers: { cookie } })).status).toBe(404)
      expect((await fetch(contractPath, { redirect: 'manual' })).headers.get('location')).toBe('/auth')
      const anonymousPage = await fetch(`/clients/${clientId}/projects/new`, { redirect: 'manual' })
      expect(anonymousPage.headers.get('location')).toBe('/auth')
    } finally {
      await database.sql`DELETE FROM projects WHERE client_id = ${clientId} OR client_id = ${otherId}`
      await database.sql`DELETE FROM clients WHERE id = ${clientId} OR id = ${otherId}`
    }
  })

  it('rejects cross-origin login requests', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://other.example.test' },
      body: JSON.stringify({ email, password })
    })
    expect(response.status).toBe(403)
  })

  it('clears the session on logout and protects the next visit', async () => {
    const cookie = sessionCookie(await login())
    const response = await fetch('/api/_auth/session', { method: 'DELETE', headers: { cookie } })
    expect(response.status).toBe(200)
    const clearedCookie = response.headers.get('set-cookie')!.split(';')[0]!
    expect(clearedCookie).toBe('nuxt-session=')
    expect((await fetch('/', { headers: { cookie: clearedCookie }, redirect: 'manual' })).headers.get('location')).toBe('/auth')
  })

  it('rejects non-JSON login requests', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=owner%40example.test&password=invalid'
    })
    expect(response.status).toBe(415)
  })

  it('uses DB credential updates immediately and invalidates old sessions', async () => {
    const cookie = sessionCookie(await login())
    const newPassword = 'updated-database-password'
    const newEmail = 'updated@example.test'
    try {
      await seedOwner(database.sql, { email: newEmail, hash: await new Scrypt({}).make(newPassword) })
      expect((await login()).status).toBe(401)
      expect((await login({ email: newEmail, password: newPassword })).status).toBe(200)
      const response = await fetch('/', { headers: { cookie }, redirect: 'manual' })
      expect(response.headers.get('location')).toBe('/auth')
    } finally {
      await seedOwner(database.sql, { email, hash })
    }
  })

  it('fails closed when the owner account is not seeded', async () => {
    try {
      await database.sql`DELETE FROM "user"`
      expect((await login()).status).toBe(503)
    } finally {
      await seedOwner(database.sql, { email, hash })
    }
  })

  it('limits repeated login attempts', async () => {
    expect((await login()).status).toBe(200)
    for (let attempt = 0; attempt < 10; attempt++) {
      expect((await login({ email, password: 'incorrect-password' })).status).toBe(401)
    }
    const response = await login({ email, password: 'incorrect-password' })
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
  })
})
