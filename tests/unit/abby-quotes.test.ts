import { describe, expect, it, vi } from 'vitest'
import { downloadAbbyQuotePdf, fetchAbbyQuote, fetchAbbyQuotes, quoteBelongsToClient } from '../../server/services/abby-quotes'

const config = { apiKey: 'test-only', baseUrl: 'https://api.app-abby.com' }
const organization = { kind: 'organization' as const, abbyId: 'org-1' }
const individual = { kind: 'individual' as const, abbyId: 'contact-1' }
function estimate(id = 'quote-1', customer = { organizationId: 'org-1' }) {
  return { id, number: 'D-001', title: 'Site web', state: 'signed', type: 'estimate', customer, currencyCode: 'EUR', totalAmountWithTaxAfterDiscount: 120000 }
}
function page(docs: unknown[], index = 1, hasNextPage = false) {
  return Response.json({ docs, page: index, hasNextPage, nextPage: hasNextPage ? index + 1 : null })
}

describe('Abby estimates', () => {
  it('downloads the official PDF using the authenticated endpoint without following redirects', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('%PDF-1.7\nfixture', { headers: { 'Content-Type': 'application/pdf' } }))
    expect((await downloadAbbyQuotePdf(config, 'quote-1', request)).toString()).toBe('%PDF-1.7\nfixture')
    expect(String(request.mock.calls[0]![0])).toBe('https://api.app-abby.com/v2/billing/quote-1/download?locale=fr')
    expect(request.mock.calls[0]![1]).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer test-only', Accept: 'application/pdf' } })
  })

  it('rejects non-PDF, oversized and unauthorized downloads', async () => {
    for (const response of [
      new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }),
      new Response('invalid', { headers: { 'Content-Type': 'application/pdf' } }),
      new Response(Buffer.alloc(10 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/pdf' } }),
      new Response('', { status: 401 })
    ]) {
      await expect(downloadAbbyQuotePdf(config, 'quote-1', vi.fn().mockResolvedValue(response))).rejects.toThrow()
    }
  })

  it('paginates, filters by organization and excludes documents belonging to other clients or types', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(page([estimate(), estimate('other', { organizationId: 'other' }), { ...estimate('invoice'), type: 'invoice' }], 1, true))
      .mockResolvedValueOnce(page([estimate('quote-2')], 2))
    expect(await fetchAbbyQuotes(config, organization, request)).toEqual([
      { id: 'quote-1', number: 'D-001', title: 'Site web', state: 'signed', amountWithTax: 120000, currencyCode: 'EUR' },
      expect.objectContaining({ id: 'quote-2' })
    ])
    const [url, options] = request.mock.calls[0]!
    expect(String(url)).toContain('/v2/billings?')
    expect(new URL(String(url)).searchParams.get('organizationId')).toBe('org-1')
    expect(new URL(String(url)).searchParams.get('type')).toBe('estimate')
    expect(options).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer test-only' } })
    expect(new URL(String(request.mock.calls[1]![0])).searchParams.get('page')).toBe('2')
  })

  it('matches contacts using contact IDs, excluding organization contacts', () => {
    expect(quoteBelongsToClient({ id: 'billing-id', contactId: 'contact-1' }, individual)).toBe(true)
    expect(quoteBelongsToClient({ id: 'contact-1', contactId: 'other' }, individual)).toBe(false)
    expect(quoteBelongsToClient({ contactId: 'contact-1', organizationId: 'org-1' }, individual)).toBe(false)
    expect(quoteBelongsToClient({ contactId: 'contact-1', parent: { organizationId: 'org-1' } }, organization)).toBe(true)
  })

  it('fetches a selected quote live and verifies its customer, type and identity', async () => {
    const payload = { ...estimate(), total: { amountWithTaxAfterDiscount: 120000 } }
    const request = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(payload))
    expect(await fetchAbbyQuote(config, organization, 'quote-1', request)).toMatchObject({ id: 'quote-1', amountWithTax: 120000 })
    expect(String(request.mock.calls[0]![0])).toBe('https://api.app-abby.com/v2/billing/quote-1')
    for (const replacement of [{ ...payload, customer: { organizationId: 'other' } }, { ...payload, type: 'invoice' }, { ...payload, id: 'other' }]) {
      request.mockResolvedValueOnce(Response.json(replacement))
      await expect(fetchAbbyQuote(config, organization, 'quote-1', request)).rejects.toMatchObject({ statusCode: 400 })
    }
  })

  it('rejects malformed pages, duplicate estimates, invalid totals and unauthorized hosts', async () => {
    await expect(fetchAbbyQuotes(config, organization, vi.fn().mockResolvedValue(Response.json({ docs: [] })))).rejects.toThrow('pagination')
    await expect(fetchAbbyQuotes(config, organization, vi.fn().mockResolvedValue(page([estimate(), estimate()])))).rejects.toThrow('plusieurs fois')
    await expect(fetchAbbyQuotes(config, organization, vi.fn().mockResolvedValue(page([{ ...estimate(), totalAmountWithTaxAfterDiscount: '1200' }])))).rejects.toThrow('invalide')
    const request = vi.fn()
    await expect(fetchAbbyQuotes({ ...config, baseUrl: 'https://example.com' }, organization, request)).rejects.toThrow('invalide')
    await expect(fetchAbbyQuotes({ ...config, apiKey: '' }, organization, request)).rejects.toMatchObject({ statusCode: 503 })
    expect(request).not.toHaveBeenCalled()
  })

  it('surfaces Abby authorization and rate-limit failures', async () => {
    for (const [status, expected] of [[401, 502], [429, 429]]) {
      await expect(fetchAbbyQuotes(config, organization, vi.fn().mockResolvedValue(new Response('', { status })))).rejects.toMatchObject({ statusCode: expected })
    }
  })
})
