import { createHash, randomBytes } from 'node:crypto'
import type postgres from 'postgres'
import type { DocusignSettings } from '../../shared/types/email'
import { decryptSetting, encryptSetting } from './settings-secrets'
import { SettingsError } from './settings'
import { hasEmailControls } from './email-templates'

interface DocusignRow {
  environment: 'demo' | 'production'
  integration_key: string
  client_secret: string
  redirect_uri: string
  access_token: string
  refresh_token: string
  expires_at: Date | null
  account_id: string
  account_name: string
  base_uri: string
}

function oauthOrigin(environment: string) {
  return environment === 'production' ? 'https://account.docusign.com' : 'https://account-d.docusign.com'
}

export function docusignBaseUri(value: unknown) {
  if (typeof value !== 'string') throw new SettingsError('Adresse DocuSign invalide.', 502)
  const url = new URL(value)
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.docusign\.net$/.test(url.hostname)
    || url.username || url.password || url.port || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new SettingsError('Adresse DocuSign invalide.', 502)
  }
  return url.origin
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SettingsError('Réponse DocuSign invalide.', 502)
  return value as Record<string, unknown>
}

async function requestJson(url: string, init: RequestInit, request: typeof fetch) {
  let response: Response
  try {
    response = await request(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30000) })
  } catch {
    throw new SettingsError('DocuSign n’a pas confirmé la requête. Vérifiez votre compte avant de réessayer.', 502)
  }
  if (!response.ok && response.status >= 500) throw new SettingsError('DocuSign n’a pas confirmé la requête. Vérifiez votre compte avant de réessayer.', 502)
  if (!response.ok) throw new SettingsError(response.status === 401
    ? 'Reconnectez votre compte DocuSign dans les paramètres.'
    : 'DocuSign a refusé la requête. Vérifiez le compte, les droits API et le document.', 502)
  try {
    return record(await response.json())
  } catch (error) {
    if (error instanceof SettingsError) throw error
    throw new SettingsError('DocuSign n’a pas confirmé la requête. Vérifiez votre compte avant de réessayer.', 502)
  }
}

async function token(row: DocusignRow, params: URLSearchParams, secret: string, request: typeof fetch) {
  const credentials = `${row.integration_key}:${decryptSetting(row.client_secret, secret)}`
  const data = await requestJson(`${oauthOrigin(row.environment)}/oauth/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${Buffer.from(credentials).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  }, request)
  if (typeof data.access_token !== 'string' || !data.access_token || typeof data.refresh_token !== 'string' || !data.refresh_token
    || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
    throw new SettingsError('Les identifiants renvoyés par DocuSign sont invalides.', 502)
  }
  return { access: data.access_token, refresh: data.refresh_token, expires: new Date(Date.now() + data.expires_in * 1000) }
}

export async function getDocusignSettings(sql: postgres.Sql): Promise<DocusignSettings> {
  const [row] = await sql`
    SELECT environment, integration_key AS "integrationKey", client_secret <> '' AS "secretConfigured",
      redirect_uri AS "redirectUri", refresh_token <> '' AND account_id <> '' AS connected,
      account_name AS "accountName" FROM docusign_settings WHERE id = 1
  `
  if (!row) throw new SettingsError('Appliquez les migrations pour configurer DocuSign.', 503)
  return row as DocusignSettings
}

export async function saveDocusignSettings(sql: postgres.Sql, value: unknown, secret: string) {
  const input = record(value)
  if (!['demo', 'production'].includes(String(input.environment)) || typeof input.integrationKey !== 'string'
    || !/^[a-zA-Z0-9-]{1,100}$/.test(input.integrationKey) || typeof input.clientSecret !== 'string'
    || input.clientSecret.length > 4096 || hasEmailControls(input.clientSecret) || typeof input.redirectUri !== 'string') {
    throw new SettingsError('Les paramètres DocuSign sont invalides.')
  }
  let redirect: URL
  try {
    redirect = new URL(input.redirectUri)
  } catch {
    throw new SettingsError('L’URL de retour DocuSign est invalide.')
  }
  if ((redirect.protocol !== 'https:' && !(redirect.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(redirect.hostname)))
    || redirect.username || redirect.password || redirect.search || redirect.hash || redirect.pathname !== '/api/docusign/callback') {
    throw new SettingsError('Utilisez l’URL HTTPS de votre app suivie de /api/docusign/callback (HTTP autorisé sur localhost).')
  }
  const encrypted = encryptSetting(input.clientSecret, secret)
  // Changing integration settings invalidates old tokens and pending authorization.
  await sql`
    UPDATE docusign_settings SET environment = ${String(input.environment)}, integration_key = ${input.integrationKey},
      client_secret = CASE WHEN ${encrypted} <> '' THEN ${encrypted} ELSE client_secret END,
      redirect_uri = ${redirect.href}, access_token = '', refresh_token = '', account_id = '', account_name = '',
      base_uri = '', expires_at = NULL, oauth_state_hash = NULL, oauth_expires_at = NULL, updated_at = now() WHERE id = 1
  `
  return getDocusignSettings(sql)
}

export async function startDocusignAuthorization(sql: postgres.Sql) {
  const settings = await getDocusignSettings(sql)
  if (!settings.integrationKey || !settings.secretConfigured || !settings.redirectUri) throw new SettingsError('Enregistrez les identifiants DocuSign avant de connecter le compte.', 409)
  const state = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(state).digest('hex')
  await sql`UPDATE docusign_settings SET oauth_state_hash = ${hash}, oauth_expires_at = now() + interval '10 minutes' WHERE id = 1`
  const url = new URL('/oauth/auth', oauthOrigin(settings.environment))
  url.search = new URLSearchParams({ response_type: 'code', scope: 'signature extended', client_id: settings.integrationKey, redirect_uri: settings.redirectUri, state }).toString()
  return { url: url.href, state }
}

export async function completeDocusignAuthorization(sql: postgres.Sql, code: string, state: string, secret: string, request: typeof fetch = fetch) {
  if (!code || code.length > 4096 || !/^[a-zA-Z0-9_-]{43}$/.test(state)) throw new SettingsError('Autorisation DocuSign invalide.')
  const hash = createHash('sha256').update(state).digest('hex')
  const [row] = await sql<DocusignRow[]>`
    UPDATE docusign_settings SET oauth_state_hash = NULL, oauth_expires_at = NULL
    WHERE id = 1 AND oauth_state_hash = ${hash} AND oauth_expires_at > now() RETURNING *
  `
  if (!row) throw new SettingsError('L’autorisation DocuSign a expiré ou a déjà été utilisée.')
  const tokens = await token(row, new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: row.redirect_uri }), secret, request)
  const info = await requestJson(`${oauthOrigin(row.environment)}/oauth/userinfo`, { headers: { Authorization: `Bearer ${tokens.access}` } }, request)
  if (!Array.isArray(info.accounts)) throw new SettingsError('Aucun compte DocuSign disponible.', 502)
  const accounts = info.accounts.map(record)
  const account = accounts.find(account => account.is_default === true || account.is_default === 'true') ?? accounts[0]
  if (!account || typeof account.account_id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(account.account_id)) throw new SettingsError('Le compte DocuSign est invalide.', 502)
  const base = docusignBaseUri(account.base_uri)
  const updated = await sql`
    UPDATE docusign_settings SET access_token = ${encryptSetting(tokens.access, secret)}, refresh_token = ${encryptSetting(tokens.refresh, secret)},
      expires_at = ${tokens.expires}, account_id = ${account.account_id}, account_name = ${String(account.account_name ?? '')},
      base_uri = ${base}, updated_at = now()
    WHERE id = 1 AND integration_key = ${row.integration_key} AND client_secret = ${row.client_secret}
      AND environment = ${row.environment} AND redirect_uri = ${row.redirect_uri} RETURNING id
  `
  if (!updated.length) throw new SettingsError('La configuration DocuSign a changé. Reconnectez le compte.', 409)
}

export async function disconnectDocusign(sql: postgres.Sql) {
  await sql`
    UPDATE docusign_settings SET access_token = '', refresh_token = '', expires_at = NULL,
      account_id = '', account_name = '', base_uri = '', oauth_state_hash = NULL, oauth_expires_at = NULL WHERE id = 1
  `
  return getDocusignSettings(sql)
}

async function accountAccess(sql: postgres.Sql, secret: string, request: typeof fetch) {
  // Serialize token refreshes so concurrent sends do not discard rotated tokens.
  return sql.begin(async (transaction) => {
    const [row] = await transaction<DocusignRow[]>`SELECT * FROM docusign_settings WHERE id = 1 FOR UPDATE`
    if (!row?.refresh_token || !row.account_id) throw new SettingsError('Connectez DocuSign dans les paramètres.', 409)
    let access = decryptSetting(row.access_token, secret)
    if (!row.expires_at || new Date(row.expires_at).getTime() < Date.now() + 120000) {
      const tokens = await token(row, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decryptSetting(row.refresh_token, secret) }), secret, request)
      access = tokens.access
      await transaction`
        UPDATE docusign_settings SET access_token = ${encryptSetting(tokens.access, secret)},
          refresh_token = ${encryptSetting(tokens.refresh, secret)}, expires_at = ${tokens.expires}, updated_at = now() WHERE id = 1
      `
    }
    return { access, accountId: row.account_id, baseUri: docusignBaseUri(row.base_uri) }
  })
}

export function envelopeDefinition(input: { id: string, to: string, name: string, subject: string, text: string, filename: string, pdf: Buffer }) {
  if (!input.subject || input.subject.length > 100 || input.text.length > 10000) throw new SettingsError('Pour DocuSign, limitez l’objet à 100 caractères et le message à 10 000 caractères.')
  return {
    emailSubject: input.subject, emailBlurb: input.text, status: 'sent', transactionId: input.id,
    documents: [{ documentBase64: input.pdf.toString('base64'), name: input.filename, fileExtension: 'pdf', documentId: '1' }],
    // Free-form signing: the signer places their signature on the original Abby PDF.
    recipients: { signers: [{ email: input.to, name: input.name, recipientId: '1', routingOrder: '1' }] }
  }
}

export async function sendDocusignEnvelope(sql: postgres.Sql, secret: string, input: Parameters<typeof envelopeDefinition>[0], request: typeof fetch = fetch) {
  const definition = envelopeDefinition(input)
  const account = await accountAccess(sql, secret, request)
  const url = `${account.baseUri}/restapi/v2.1/accounts/${encodeURIComponent(account.accountId)}/envelopes`
  const data = await requestJson(url, {
    method: 'POST', headers: { 'Authorization': `Bearer ${account.access}`, 'Content-Type': 'application/json' }, body: JSON.stringify(definition)
  }, request)
  if (typeof data.envelopeId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(data.envelopeId) || data.status !== 'sent') {
    throw new SettingsError('DocuSign n’a pas confirmé l’envoi. Vérifiez votre compte avant de réessayer.', 502)
  }
  return data.envelopeId
}
