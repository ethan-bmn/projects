import { describe, expect, it, vi } from 'vitest'
import { fetchAbbyClients } from '../../server/services/abby-client'
import { syncIsDue } from '../../server/services/client-sync'

const config = { apiKey: 'secret-test-key', baseUrl: 'https://api.app-abby.com' }
const item = { id: 'abby-1', name: 'Dupont SARL', emails: ['info@example.test'], commercialName: 'Atelier Dupont', billingAddress: null }
const page = (docs: unknown[], number = 1, hasNextPage = false) => Response.json({ docs: docs.map(doc => doc && typeof doc === 'object' ? { billingAddress: null, ...doc } : doc), page: number, hasNextPage, nextPage: hasNextPage ? number + 1 : null })

describe('Abby segmented client API', () => {
  it('retrieves standalone contact details when list records omit billing addresses', async () => {
    const address = { address: '12 rue du Test', zipCode: '69003', city: 'Lyon', country: 'FR' }
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(Response.json({ docs: [{ id: 'person', fullname: 'Marie' }], page: 1, hasNextPage: false }))
      .mockResolvedValueOnce(Response.json({ id: 'person', billingAddress: address }))
    expect((await fetchAbbyClients(config, request))[0]!.billingAddress).toMatchObject(address)
    const [url, options] = request.mock.calls[2]!
    expect(new URL(String(url)).pathname).toBe('/contact/person')
    expect(options?.redirect).toBe('error')
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer secret-test-key' })
  })

  it('fails the import if contact detail retrieval fails rather than clearing stored addresses', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(Response.json({ docs: [{ id: 'person', fullname: 'Marie' }], page: 1, hasNextPage: false }))
      .mockResolvedValueOnce(new Response('private upstream error', { status: 500 }))
    await expect(fetchAbbyClients(config, request)).rejects.toThrow('indisponible')
  })

  it('imports structured billing addresses for companies and standalone people', async () => {
    const address = { address: ' 12 rue du Test ', complement: 'Bâtiment A', zipCode: '69003', city: 'Lyon', country: 'FR' }
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(page([{ ...item, billingAddress: address }]))
      .mockResolvedValueOnce(page([{ id: 'person', fullname: 'Marie', billingAddress: { address: '8 rue Neuve', city: 'Paris', zipCode: '75001' } }]))
    const clients = await fetchAbbyClients(config, request)
    expect(clients[0]!.billingAddress).toEqual({ ...address, address: '12 rue du Test', state: null })
    expect(clients[1]!.billingAddress).toEqual({ address: '8 rue Neuve', complement: null, city: 'Paris', zipCode: '75001', country: null, state: null })
  })

  it('normalizes empty addresses and rejects malformed address components', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(page([{ ...item, billingAddress: { address: ' ', city: null } }])).mockResolvedValueOnce(page([]))
    expect((await fetchAbbyClients(config, request))[0]!.billingAddress).toBeNull()
    const invalid = vi.fn<typeof fetch>().mockResolvedValueOnce(page([{ ...item, billingAddress: { zipCode: 69003 } }]))
    await expect(fetchAbbyClients(config, invalid)).rejects.toThrow('adresse de facturation')
  })

  it('fetches every page with server-only authentication and normalizes list fields', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(page([item], 1, true))
      .mockResolvedValueOnce(page([{ id: 'abby-2', name: 'Durand SAS' }], 2))
      .mockResolvedValueOnce(page([{ id: 'person-1', fullname: 'Marie Durand', emails: ['marie@example.test'] }]))
    const result = await fetchAbbyClients(config, request)
    expect(result).toEqual([
      { id: 'abby-1', kind: 'organization', name: 'Dupont SARL', emails: ['info@example.test'], commercialName: 'Atelier Dupont', billingAddress: null },
      { id: 'abby-2', kind: 'organization', name: 'Durand SAS', emails: [], commercialName: null, billingAddress: null },
      { id: 'person-1', kind: 'individual', name: 'Marie Durand', emails: ['marie@example.test'], commercialName: null, billingAddress: null }
    ])
    expect(request).toHaveBeenCalledTimes(3)
    const [url, options] = request.mock.calls[1]!
    expect(String(url)).toContain('page=2')
    expect(new URL(String(url)).pathname).toBe('/organizations')
    expect(String(url)).toContain('archived=false')
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer secret-test-key' })
    expect(options?.redirect).toBe('error')
    expect(new URL(String(request.mock.calls[2]![0])).pathname).toBe('/contacts')
  })

  it.each([401, 403, 429, 500])('reports status %s without returning the upstream body', async (status) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(config.apiKey, { status }))
    await expect(fetchAbbyClients(config, request)).rejects.not.toThrow(config.apiKey)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed clients and invalid pagination', async () => {
    await expect(fetchAbbyClients(config, vi.fn<typeof fetch>().mockResolvedValue(page([{ name: 'Missing ID' }])))).rejects.toThrow('client')
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ docs: [item], page: 1, hasNextPage: true, nextPage: 1 }))
    await expect(fetchAbbyClients(config, request)).rejects.toThrow('pagination')
  })

  it.each([
    { id: 'bad', fullname: 'Person record' },
    { id: 'bad', name: 'Company', commercialName: 42 },
    { id: 'bad', name: 'Company', emails: [42] }
  ])('rejects invalid organization fields: %j', async (value) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(page([value]))
    await expect(fetchAbbyClients(config, request)).rejects.toThrow('client')
  })

  it('rejects duplicate clients across pages', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(page([item], 1, true)).mockResolvedValueOnce(page([item], 2))
    await expect(fetchAbbyClients(config, request)).rejects.toThrow('même client')
  })

  it('does not send the key to untrusted hosts or without HTTPS', async () => {
    const request = vi.fn<typeof fetch>()
    for (const baseUrl of ['https://attacker.example', 'http://api.app-abby.com', 'https://api.app-abby.com@attacker.example', 'https://api.app-abby.com/other']) {
      await expect(fetchAbbyClients({ ...config, baseUrl }, request)).rejects.toThrow('adresse')
    }
    await expect(fetchAbbyClients({ ...config, apiKey: '' }, request)).rejects.toThrow('configurée')
    expect(request).not.toHaveBeenCalled()
  })

  it('sanitizes network errors', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error(config.apiKey))
    await expect(fetchAbbyClients(config, request)).rejects.toThrow('Impossible de joindre Abby')
  })

  it('represents linked people once through their organization and keeps standalone people', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(page([item]))
      .mockResolvedValueOnce(page([
        { id: 'employee-1', fullname: 'Jean Dupont', organization: { id: item.id, name: item.name } },
        { id: 'employee-2', fullname: 'Marie Dupont', organization: { id: item.id, name: item.name } },
        { id: item.id, fullname: 'Standalone person', emails: ['person@example.test'], organization: null }
      ]))
    expect(await fetchAbbyClients(config, request)).toEqual([
      { ...item, kind: 'organization' },
      { id: item.id, kind: 'individual', name: 'Standalone person', emails: ['person@example.test'], commercialName: null, billingAddress: null }
    ])
  })

  it('uses embedded organization information if an active organization is absent from the list', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([
        { id: 'employee-1', fullname: 'Jean', organization: { id: 'org-missing', name: 'Embedded company' } },
        { id: 'employee-2', fullname: 'Marie', organization: { id: 'org-missing', name: 'Embedded company' } }
      ]))
    expect(await fetchAbbyClients(config, request)).toEqual([
      { id: 'org-missing', kind: 'organization', name: 'Embedded company', emails: [], commercialName: null, billingAddress: null }
    ])
  })

  it('does not turn people at archived organizations into standalone clients', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([{ id: 'employee', fullname: 'Jean', organization: { id: 'archived', name: 'Archived company', archivedAt: 1234567890 } }]))
    expect(await fetchAbbyClients(config, request)).toEqual([])
  })

  it('fetches every page of standalone contacts too', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([{ id: 'person-1', fullname: 'Jean' }], 1, true))
      .mockResolvedValueOnce(page([{ id: 'person-2', fullname: 'Marie' }], 2))
    expect(await fetchAbbyClients(config, request)).toMatchObject([
      { id: 'person-1', kind: 'individual', name: 'Jean' },
      { id: 'person-2', kind: 'individual', name: 'Marie' }
    ])
    expect(new URL(String(request.mock.calls[1]![0])).searchParams.get('page')).toBe('1')
    expect(new URL(String(request.mock.calls[2]![0])).searchParams.get('page')).toBe('2')
  })

  it.each([
    { id: 'bad', name: 'Wrong field' },
    { id: 'bad', fullname: 'Jean', emails: [42] },
    { id: 'bad', fullname: 'Jean', organization: { id: '', name: 'Company' } },
    { id: 'bad', fullname: 'Jean', organization: { id: 'org', name: 'Company', archivedAt: 'bad' } }
  ])('rejects invalid standalone or linked contact fields: %j', async (value) => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([value]))
    await expect(fetchAbbyClients(config, request)).rejects.toThrow('client')
  })
})

describe('daily sync schedule', () => {
  const now = Date.parse('2026-10-11T12:00:00Z')
  it('runs initially and after 24 hours, but backs off failed attempts for an hour', () => {
    expect(syncIsDue(null, null, now)).toBe(true)
    expect(syncIsDue(new Date(now - 23 * 3600_000), null, now)).toBe(false)
    expect(syncIsDue(new Date(now - 24 * 3600_000), null, now)).toBe(true)
    expect(syncIsDue(null, new Date(now - 59 * 60_000), now)).toBe(false)
    expect(syncIsDue(null, new Date(now - 60 * 60_000), now)).toBe(true)
  })
})
