import type postgres from 'postgres'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import type { GlobalSettings } from '../../shared/types/settings'

export class SettingsError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message)
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SettingsError('Les paramètres sont invalides.')
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, max: number, optional = false) {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) {
    throw new SettingsError(`Le champ « ${label} » est invalide (maximum ${max} caractères).`)
  }
  return value.trim()
}

function email(value: unknown) {
  const result = text(value, 'Adresse e-mail', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new SettingsError('L’adresse e-mail est invalide.')
  return result
}

export function validateAbbyKey(value: unknown) {
  const apiKey = text(object(value).apiKey, 'Clé API Abby', 8192, true)
  if (apiKey && !/^[\x21-\x7E]+$/.test(apiKey)) throw new SettingsError('La clé API Abby contient des caractères invalides.')
  return apiKey
}

export function validateAccount(value: unknown) {
  const input = object(value)
  const accountEmail = email(input.email)
  if (typeof input.currentPassword !== 'string' || !input.currentPassword.length || input.currentPassword.length > 1024) {
    throw new SettingsError('Saisissez votre mot de passe actuel.')
  }
  if (typeof input.newPassword !== 'string' || (input.newPassword !== '' && (input.newPassword.length < 12 || input.newPassword.length > 1024))) {
    throw new SettingsError('Le nouveau mot de passe doit contenir entre 12 et 1024 caractères.')
  }
  return { email: accountEmail, currentPassword: input.currentPassword, newPassword: input.newPassword }
}

export async function getGlobalSettings(sql: postgres.Sql): Promise<GlobalSettings> {
  const [row] = await sql`
    SELECT u.email, a.api_key ~ '[^[:space:]]' AS abby_configured
    FROM "user" u CROSS JOIN abby_settings a
    WHERE u.id = 1 AND a.id = 1
  `
  if (!row) throw new SettingsError('Les paramètres ne sont pas initialisés. Appliquez les migrations.', 503)
  return {
    email: row.email,
    abbyConfigured: row.abby_configured
  }
}

export async function saveAbbyKey(sql: postgres.Sql, value: unknown) {
  const apiKey = validateAbbyKey(value)
  await sql`
    INSERT INTO abby_settings (id, api_key) VALUES (1, ${apiKey})
    ON CONFLICT (id) DO UPDATE SET api_key = EXCLUDED.api_key, updated_at = now()
  `
  return { configured: Boolean(apiKey) }
}

export async function saveAccount(sql: postgres.Sql, value: unknown, expected: { email: string, password_hash: string }) {
  const input = validateAccount(value)
  return sql.begin(async (transaction) => {
    const [owner] = await transaction<{ email: string, password_hash: string }[]>`
      SELECT email, password_hash FROM "user" WHERE id = 1 FOR UPDATE
    `
    if (!owner || owner.email !== expected.email || owner.password_hash !== expected.password_hash) {
      throw new SettingsError('Votre session a expiré. Reconnectez-vous.', 401)
    }
    const scrypt = new Scrypt({})
    if (!await scrypt.verify(owner.password_hash, input.currentPassword)) throw new SettingsError('Le mot de passe actuel est incorrect.', 403)
    const hash = input.newPassword ? await scrypt.make(input.newPassword) : owner.password_hash
    await transaction`UPDATE "user" SET email = ${input.email}, password_hash = ${hash}, updated_at = now() WHERE id = 1`
    return { email: input.email, password_hash: hash }
  })
}
