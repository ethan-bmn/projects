import type { Client } from '../../shared/types/clients'
import type { AbbyQuote } from '../../shared/types/quotes'
import { AbbySyncError, abbyClientsUrl, fetchAbbyJson } from './abby-client'
import type { AbbyConfig } from './abby-client'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AbbySyncError('Le devis reçu d’Abby est invalide.')
  return value as Record<string, unknown>
}

export function quoteBelongsToClient(value: unknown, client: Pick<Client, 'kind' | 'abbyId'>): boolean {
  const customer = object(value)
  // Local clients use contact/organization IDs, rather than billing-customer IDs.
  return client.kind === 'organization'
    ? customer.organizationId === client.abbyId || (customer.parent != null && object(customer.parent).organizationId === client.abbyId)
    : customer.contactId === client.abbyId && !customer.organizationId && !customer.parent
}

function quote(value: unknown, detail = false): AbbyQuote {
  const item = object(value)
  const amount = detail ? object(item.total).amountWithTaxAfterDiscount : item.totalAmountWithTaxAfterDiscount
  if (typeof item.id !== 'string' || !item.id || item.type !== 'estimate'
    || typeof item.state !== 'string' || typeof item.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(item.currencyCode)
    || typeof amount !== 'number' || !Number.isFinite(amount)
    || (item.number != null && typeof item.number !== 'string') || (item.title != null && typeof item.title !== 'string')) {
    throw new AbbySyncError('Le devis reçu d’Abby est invalide.')
  }
  return { id: item.id, number: item.number as string ?? null, title: item.title as string ?? null, state: item.state, amountWithTax: amount, currencyCode: item.currencyCode }
}

function endpoint(config: AbbyConfig, path: string) {
  if (!config.apiKey.trim()) throw new AbbySyncError('La clé API Abby n’est pas configurée.', 503)
  return new URL(path, abbyClientsUrl(config.baseUrl))
}

export async function fetchAbbyQuotes(config: AbbyConfig, client: Pick<Client, 'kind' | 'abbyId'>, request: typeof fetch = fetch): Promise<AbbyQuote[]> {
  const url = endpoint(config, '/v2/billings')
  const deadline = Date.now() + 60_000
  const quotes = new Map<string, AbbyQuote>()
  for (let page = 1; page <= 1000; page++) {
    // Abby's customerId is a billing-customer ID, not our synchronized contact ID.
    url.search = new URLSearchParams({ page: String(page), limit: '100', type: 'estimate', test: 'false', archived: 'false',
      ...(client.kind === 'organization' ? { organizationId: client.abbyId } : {}) }).toString()
    const payload = await fetchAbbyJson(url, config, request, deadline)
    if (!Array.isArray(payload.docs) || payload.page !== page || typeof payload.hasNextPage !== 'boolean') throw new AbbySyncError('La pagination Abby est invalide.')
    for (const value of payload.docs) {
      const item = object(value)
      if (item.type !== 'estimate' || !quoteBelongsToClient(item.customer, client)) continue
      const normalized = quote(item)
      if (quotes.has(normalized.id)) throw new AbbySyncError('Abby a renvoyé plusieurs fois le même devis.')
      quotes.set(normalized.id, normalized)
    }
    if (!payload.hasNextPage) return [...quotes.values()]
    if (payload.nextPage !== page + 1 || !payload.docs.length) throw new AbbySyncError('La pagination Abby est invalide.')
  }
  throw new AbbySyncError('Le nombre de pages de devis Abby est trop élevé.')
}

export async function fetchAbbyQuote(config: AbbyConfig, client: Pick<Client, 'kind' | 'abbyId'>, id: string, request: typeof fetch = fetch): Promise<AbbyQuote> {
  const payload = await fetchAbbyJson(endpoint(config, `/v2/billing/${encodeURIComponent(id)}`), config, request, Date.now() + 20_000)
  if (payload.id !== id || payload.type !== 'estimate' || !quoteBelongsToClient(payload.customer, client)) {
    throw new AbbySyncError('Ce devis n’appartient pas à ce client.', 400)
  }
  return quote(payload, true)
}
