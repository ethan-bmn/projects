import type postgres from 'postgres'
import type { Prospect, ProspectInput, ProspectList } from '../../shared/types/prospects'

export class ProspectError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message)
  }
}

export function validateProspectInput(value: unknown): ProspectInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProspectError('Le prospect est invalide.')
  const input = value as Record<string, unknown>
  function text(key: string, max: number, required = false) {
    const value = input[key]
    if (!required && value == null) return ''
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
      throw new ProspectError(`Le champ « ${key === 'name' ? 'Nom' : key === 'domain' ? 'Domaine' : key === 'idea' ? 'Idée' : key} » est invalide (maximum ${max} caractères).`)
    }
    return value.trim()
  }
  const name = text('name', 200, true)
  const domain = text('domain', 200, true)
  const idea = text('idea', 5000)
  const email = text('email', 254)
  const phone = text('phone', 50)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ProspectError('L’adresse e-mail est invalide.')
  if (phone && !/^\+?[\d\s()./-]+$/.test(phone)) throw new ProspectError('Le numéro de téléphone est invalide.')
  if (phone && phone.replace(/\D/g, '').length < 3) throw new ProspectError('Le numéro de téléphone est invalide.')
  if (!email && !phone) throw new ProspectError('Renseignez une adresse e-mail ou un numéro de téléphone.')
  const websiteUrl = text('websiteUrl', 2048) || null
  if (websiteUrl) {
    try {
      const url = new URL(websiteUrl)
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error()
    } catch {
      throw new ProspectError('Le site web doit être une URL http:// ou https:// valide.')
    }
  }
  return { name, domain, email, phone, websiteUrl, idea }
}

interface ProspectRow extends Omit<ProspectInput, 'websiteUrl'> {
  id: string
  website_url: string | null
  created_at: Date
  updated_at: Date
}

function prospect(row: ProspectRow): Prospect {
  return {
    id: row.id, name: row.name, email: row.email, phone: row.phone, domain: row.domain,
    websiteUrl: row.website_url, idea: row.idea, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()
  }
}

export async function listProspects(sql: postgres.Sql, page = 1, search = ''): Promise<ProspectList> {
  const pageSize = 50
  // Treat the search as literal text, including SQL wildcard characters.
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`
  return sql.begin(async (transaction) => {
    const rows = await transaction<ProspectRow[]>`
      SELECT * FROM prospects
      WHERE name ILIKE ${pattern} OR domain ILIKE ${pattern} OR email ILIKE ${pattern} OR phone ILIKE ${pattern} OR idea ILIKE ${pattern}
      ORDER BY name, id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `
    const [count] = await transaction`
      SELECT count(*)::integer AS total FROM prospects
      WHERE name ILIKE ${pattern} OR domain ILIKE ${pattern} OR email ILIKE ${pattern} OR phone ILIKE ${pattern} OR idea ILIKE ${pattern}
    `
    return { prospects: rows.map(prospect), total: count!.total, page, pageSize }
  })
}

export async function createProspect(sql: postgres.Sql, input: ProspectInput): Promise<Prospect> {
  const [row] = await sql<ProspectRow[]>`
    INSERT INTO prospects (name, email, phone, domain, website_url, idea)
    VALUES (${input.name}, ${input.email}, ${input.phone}, ${input.domain}, ${input.websiteUrl}, ${input.idea}) RETURNING *
  `
  return prospect(row!)
}

export async function updateProspect(sql: postgres.Sql, id: string, input: ProspectInput): Promise<Prospect> {
  const [row] = await sql<ProspectRow[]>`
    UPDATE prospects SET name = ${input.name}, email = ${input.email}, phone = ${input.phone},
      domain = ${input.domain}, website_url = ${input.websiteUrl}, idea = ${input.idea}, updated_at = clock_timestamp()
    WHERE id = ${id} RETURNING *
  `
  if (!row) throw new ProspectError('Prospect introuvable.', 404)
  return prospect(row)
}

export async function deleteProspect(sql: postgres.Sql, id: string): Promise<void> {
  const rows = await sql`DELETE FROM prospects WHERE id = ${id} RETURNING id`
  if (!rows.length) throw new ProspectError('Prospect introuvable.', 404)
}
