import { createHash } from 'node:crypto'
import { jsPDF } from 'jspdf'
import type postgres from 'postgres'
import type { DocumensoSettings } from '../../shared/types/email'
import { decryptSetting, encryptSetting } from './settings-secrets'
import { SettingsError } from './settings'
import { hasEmailControls } from './email-templates'

export interface SignatureInput {
  id: string
  to: string
  name: string
  subject: string
  text: string
  filename: string
  pdf: Buffer
  envelopeId?: string | null
  onCreated?: (id: string) => Promise<void>
}

export function documensoOrigin(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid origin')
    return url.origin
  } catch {
    throw new SettingsError('Configurez une URL Documenso valide dans l’environnement du serveur.', 503)
  }
}

export async function getDocumensoSettings(sql: postgres.Sql): Promise<DocumensoSettings> {
  const [row] = await sql`SELECT api_token <> '' AS configured FROM documenso_settings WHERE id = 1`
  if (!row) throw new SettingsError('Appliquez les migrations pour configurer Documenso.', 503)
  return { configured: Boolean(row.configured), url: documensoOrigin(process.env.NUXT_PUBLIC_DOCUMENSO_URL || 'http://localhost:8082') }
}

export async function saveDocumensoSettings(sql: postgres.Sql, value: unknown, secret: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SettingsError('Les paramètres Documenso sont invalides.')
  const input = value as Record<string, unknown>
  if (typeof input.apiToken !== 'string' || input.apiToken.length > 4096
    || (input.apiToken && !/^api_[a-zA-Z0-9_-]+$/.test(input.apiToken))
    || (input.disconnect !== undefined && typeof input.disconnect !== 'boolean')) {
    throw new SettingsError('Saisissez une clé API Documenso valide (api_…).')
  }
  const encrypted = encryptSetting(input.apiToken, secret)
  await sql`UPDATE documenso_settings SET
    api_token = CASE WHEN ${input.disconnect === true} THEN '' WHEN ${encrypted} <> '' THEN ${encrypted} ELSE api_token END,
    updated_at = now() WHERE id = 1`
  return getDocumensoSettings(sql)
}

export function envelopeDefinition(input: Pick<SignatureInput, 'id' | 'to' | 'name' | 'subject' | 'text' | 'filename'>) {
  if (!input.subject || input.subject.length > 254 || input.text.length > 5000 || hasEmailControls(input.subject)) {
    throw new SettingsError('Pour Documenso, limitez l’objet à 254 caractères et le message à 5 000 caractères.')
  }
  return {
    type: 'DOCUMENT', title: input.filename, externalId: input.id,
    meta: { subject: input.subject, message: input.text, language: 'fr', distributionMethod: 'EMAIL' },
    recipients: [{ email: input.to, name: input.name, role: 'SIGNER', fields: [
      { type: 'SIGNATURE', identifier: 1, page: 1, positionX: 10, positionY: 40, width: 60, height: 15 }
    ] }]
  }
}

export function signatureSheet(input: Pick<SignatureInput, 'id' | 'filename' | 'pdf'>) {
  const document = new jsPDF()
  document.setFontSize(18)
  document.text('Signature du devis', 21, 30)
  document.setFontSize(11)
  document.text(document.splitTextToSize(`Devis joint : ${input.filename}`, 168), 21, 45)
  document.text(`Référence : ${input.id}`, 21, 65)
  document.text('Je confirme mon accord sur le devis joint à cette enveloppe.', 21, 85)
  document.setFontSize(8)
  document.text(`SHA-256 : ${createHash('sha256').update(input.pdf).digest('hex')}`, 21, 95)
  document.setFontSize(11)
  document.text('Signature :', 21, 110)
  return document.output('arraybuffer')
}

async function requestJson(origin: string, path: string, token: string, body: FormData | string, request: typeof fetch) {
  let response: Response
  try {
    response = await request(`${origin}/api/v2${path}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: token, ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}) }, body
    })
  } catch {
    throw new SettingsError('Documenso n’a pas confirmé la requête. Vérifiez l’enveloppe avant de réessayer.', 502)
  }
  if (response.status >= 500 || response.status === 408) throw new SettingsError('Documenso n’a pas confirmé la requête. Vérifiez l’enveloppe avant de réessayer.', 502)
  if (!response.ok) throw new SettingsError(response.status === 401 || response.status === 403
    ? 'Vérifiez la clé API Documenso dans les paramètres.'
    : 'Documenso a refusé la requête. Vérifiez le document, les limites du compte et la configuration SMTP.', 502)
  try {
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response')
    return data as Record<string, unknown>
  } catch {
    throw new SettingsError('Documenso n’a pas confirmé la requête. Vérifiez l’enveloppe avant de réessayer.', 502)
  }
}

export async function sendDocumensoEnvelope(sql: postgres.Sql, secret: string, input: SignatureInput, request: typeof fetch = fetch) {
  const definition = envelopeDefinition(input)
  const [row] = await sql`SELECT api_token FROM documenso_settings WHERE id = 1`
  if (!row?.api_token) throw new SettingsError('Configurez la clé API Documenso dans les paramètres.', 409)
  const token = decryptSetting(row.api_token, secret)
  const origin = documensoOrigin(process.env.NUXT_DOCUMENSO_URL || 'http://localhost:8082')
  let id = input.envelopeId
  if (!id) {
    const form = new FormData()
    form.append('payload', JSON.stringify(definition))
    form.append('files', new Blob([new Uint8Array(input.pdf)], { type: 'application/pdf' }), input.filename)
    form.append('files', new Blob([signatureSheet(input)], { type: 'application/pdf' }), 'signature.pdf')
    const created = await requestJson(origin, '/envelope/create', token, form, request)
    if (typeof created.id !== 'string' || !/^envelope_[a-zA-Z0-9_-]+$/.test(created.id)) {
      throw new SettingsError('Documenso n’a pas confirmé la création. Vérifiez les enveloppes avant de réessayer.', 502)
    }
    id = created.id
    // Persist the draft before distributing it so a rejected send can reuse it.
    await input.onCreated?.(id)
  }
  const sent = await requestJson(origin, '/envelope/distribute', token, JSON.stringify({ envelopeId: id }), request)
  if (sent.id !== id || sent.success !== true) throw new SettingsError('Documenso n’a pas confirmé l’envoi. Vérifiez l’enveloppe avant de réessayer.', 502)
  return id
}
