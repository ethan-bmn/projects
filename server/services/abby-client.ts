import type { ClientAddress, ClientKind } from '../../shared/types/clients'

export interface AbbyClient {
  id: string
  kind: ClientKind
  name: string
  emails: string[]
  commercialName: string | null
  billingAddress: ClientAddress | null
}

export class AbbySyncError extends Error {
  constructor(message: string, public statusCode = 502) {
    super(message)
  }
}

export interface AbbyConfig {
  apiKey: string
  baseUrl: string
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AbbySyncError('La réponse d’Abby est invalide.')
  }
  return value as Record<string, unknown>
}

function billingAddress(value: unknown): ClientAddress | null {
  if (value == null) return null
  const source = record(value)
  const result = {} as ClientAddress
  for (const key of ['address', 'complement', 'city', 'zipCode', 'state', 'country'] as const) {
    const content = source[key]
    if (content != null && typeof content !== 'string') throw new AbbySyncError('L’adresse de facturation d’un client Abby est invalide.')
    result[key] = typeof content === 'string' ? content.trim() || null : null
  }
  return Object.values(result).some(Boolean) ? result : null
}

function organizationClient(value: unknown): AbbyClient {
  const item = record(value)
  if (typeof item.id !== 'string' || !item.id.trim() || typeof item.name !== 'string'
    || (item.commercialName != null && typeof item.commercialName !== 'string')
    || (item.emails != null && (!Array.isArray(item.emails) || item.emails.some(email => typeof email !== 'string')))) {
    throw new AbbySyncError('Un client reçu d’Abby est invalide.')
  }
  return {
    id: item.id,
    kind: 'organization',
    name: item.name,
    emails: (item.emails ?? []) as string[],
    commercialName: item.commercialName as string | undefined ?? null,
    billingAddress: billingAddress(item.billingAddress)
  }
}

// Only documented Abby hosts are allowed; redirects must never forward the key.
export function abbyClientsUrl(baseUrl: string) {
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' || !['api.app-abby.com', 'api.abby.fr'].includes(url.hostname)
    || url.username || url.password || url.port || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new AbbySyncError('L’adresse de l’API Abby est invalide.', 503)
  }
  return new URL('/organizations', url)
}

interface AbbyContact {
  id: string
  fullname: string
  emails: string[]
  billingAddress: ClientAddress | null
  needsAddressDetail: boolean
  organization: { id: string, name: string, archived: boolean } | null
}

function contact(value: unknown): AbbyContact {
  const item = record(value)
  if (typeof item.id !== 'string' || !item.id.trim() || typeof item.fullname !== 'string'
    || (item.emails != null && (!Array.isArray(item.emails) || item.emails.some(email => typeof email !== 'string')))) {
    throw new AbbySyncError('Un client particulier reçu d’Abby est invalide.')
  }
  const organization = item.organization == null ? null : record(item.organization)
  if (organization && (typeof organization.id !== 'string' || !organization.id.trim() || typeof organization.name !== 'string'
    || (organization.archivedAt != null && (typeof organization.archivedAt !== 'number' || !Number.isFinite(organization.archivedAt))))) {
    throw new AbbySyncError('L’entreprise d’un client Abby est invalide.')
  }
  return {
    id: item.id,
    fullname: item.fullname,
    needsAddressDetail: !Object.hasOwn(item, 'billingAddress'),
    billingAddress: billingAddress(item.billingAddress),
    emails: (item.emails ?? []) as string[],
    organization: organization
      ? {
          id: organization.id as string,
          name: organization.name as string,
          archived: Number(organization.archivedAt ?? 0) > 0
        }
      : null
  }
}

async function fetchAbbyJson(url: URL, config: AbbyConfig, request: typeof fetch, deadline: number): Promise<Record<string, unknown>> {
  if (Date.now() >= deadline) throw new AbbySyncError('La synchronisation Abby a dépassé le délai autorisé.')
  let response: Response
  try {
    response = await request(url, {
      headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(Math.min(20_000, deadline - Date.now()))
    })
  } catch {
    throw new AbbySyncError('Impossible de joindre Abby. Réessayez plus tard.')
  }
  if (response.status === 401 || response.status === 403) {
    throw new AbbySyncError('Abby a refusé la clé API. Vérifiez sa validité et ses droits.', 502)
  }
  if (response.status === 429) throw new AbbySyncError('La limite de requêtes Abby est atteinte. Réessayez plus tard.', 429)
  if (!response.ok) throw new AbbySyncError('Abby est indisponible. Réessayez plus tard.')
  try {
    return record(await response.json())
  } catch {
    throw new AbbySyncError('La réponse d’Abby est invalide.')
  }
}

async function fetchPages<T extends { id: string }>(
  endpoint: URL,
  config: AbbyConfig,
  normalize: (value: unknown) => T,
  request: typeof fetch,
  deadline: number
): Promise<T[]> {
  const items = new Map<string, T>()
  let page = 1

  while (page <= 1000) {
    if (Date.now() >= deadline) throw new AbbySyncError('La synchronisation Abby a dépassé le délai autorisé.')
    const url = new URL(endpoint)
    url.search = new URLSearchParams({ page: String(page), limit: '100', archived: 'false', orderBy: 'createdAt', orderDirection: 'ASC' }).toString()
    const payload = await fetchAbbyJson(url, config, request, deadline)
    if (!Array.isArray(payload.docs) || typeof payload.hasNextPage !== 'boolean' || payload.page !== page) {
      throw new AbbySyncError('La pagination Abby est invalide.')
    }
    for (const item of payload.docs) {
      const normalized = normalize(item)
      if (items.has(normalized.id)) throw new AbbySyncError('Abby a renvoyé plusieurs fois le même client. Réessayez.')
      items.set(normalized.id, normalized)
    }
    if (!payload.hasNextPage) return [...items.values()]
    if (payload.nextPage !== page + 1 || !payload.docs.length) {
      throw new AbbySyncError('La pagination Abby est invalide.')
    }
    page++
  }
  throw new AbbySyncError('La synchronisation Abby dépasse le nombre de pages autorisé.')
}

export async function fetchAbbyClients(config: AbbyConfig, request: typeof fetch = fetch): Promise<AbbyClient[]> {
  if (!config.apiKey.trim()) throw new AbbySyncError('La clé API Abby n’est pas configurée.', 503)
  let organizationsUrl: URL
  try {
    organizationsUrl = abbyClientsUrl(config.baseUrl)
  } catch {
    throw new AbbySyncError('L’adresse de l’API Abby est invalide.', 503)
  }
  const deadline = Date.now() + 5 * 60_000
  const organizations = await fetchPages(organizationsUrl, config, organizationClient, request, deadline)
  const contacts = await fetchPages(new URL('/contacts', organizationsUrl), config, contact, request, deadline)
  const businesses = new Map(organizations.map(item => [item.id, item]))
  const individuals: AbbyClient[] = []

  for (const item of contacts) {
    if (item.organization) {
      const organization = item.organization
      if (!organization.archived && !businesses.has(organization.id)) {
        // The contact embeds enough information to represent its organization.
        businesses.set(organization.id, {
          id: organization.id, kind: 'organization', name: organization.name,
          emails: [], commercialName: null, billingAddress: null
        })
      }
    } else {
      let address = item.billingAddress
      if (item.needsAddressDetail) {
        const detail = await fetchAbbyJson(new URL(`/contact/${encodeURIComponent(item.id)}`, organizationsUrl), config, request, deadline)
        if (detail.id !== item.id) throw new AbbySyncError('Le détail du client Abby est invalide.')
        address = billingAddress(detail.billingAddress)
      }
      individuals.push({
        id: item.id, kind: 'individual', name: item.fullname,
        emails: item.emails, commercialName: null, billingAddress: address
      })
    }
  }
  return [...businesses.values(), ...individuals]
}
