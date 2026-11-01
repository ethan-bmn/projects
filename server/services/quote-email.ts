import { createHash } from 'node:crypto'
import type postgres from 'postgres'
import type { QuoteDelivery, QuoteEmailPreview, EmailVariable } from '../../shared/types/email'
import type { AbbyConfig } from './abby-client'
import { AbbySyncError } from './abby-client'
import { downloadAbbyQuotePdf, fetchAbbyQuote } from './abby-quotes'
import { getProject } from './projects'
import { getMailSettings, mailTransport } from './mail-settings'
import { emailAddress, hasEmailControls, renderEmailTemplate } from './email-templates'
import { envelopeDefinition, getDocusignSettings, sendDocusignEnvelope } from './docusign'
import { SettingsError } from './settings'

interface DeliveryRow {
  id: string
  project_id: string
  quote_id: string
  recipient: string
  recipient_name: string
  subject: string
  body: string
  filename: string
  request_hash: string
  pdf: Buffer | null
  status: QuoteDelivery['status']
  signature_status: QuoteDelivery['signatureStatus']
  envelope_id: string | null
  error: string | null
  created_at: Date
}

function delivery(row: DeliveryRow): QuoteDelivery {
  return { id: row.id, quoteId: row.quote_id, to: row.recipient, subject: row.subject, createdAt: new Date(row.created_at).toISOString(),
    status: row.status, signatureStatus: row.signature_status, envelopeId: row.envelope_id, error: row.error }
}

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function validateQuoteEmailInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SettingsError('Le message est invalide.')
  const input = value as Record<string, unknown>
  const to = emailAddress(input.to)
  if (input.signerName !== undefined && (typeof input.signerName !== 'string' || input.signerName.length > 100 || hasEmailControls(input.signerName))) throw new SettingsError('Le nom du signataire est invalide (100 caractères maximum).')
  if (typeof input.docusign !== 'boolean' || typeof input.signatureLink !== 'string' || input.signatureLink.length > 2000) throw new SettingsError('Les options de signature sont invalides.')
  if (input.signatureLink) {
    let url: URL
    try {
      url = new URL(input.signatureLink)
    } catch {
      throw new SettingsError('Le lien de signature est invalide.')
    }
    if (url.protocol !== 'https:' || url.username || url.password || hasEmailControls(input.signatureLink)) throw new SettingsError('Le lien de signature doit utiliser HTTPS.')
    if (input.docusign) throw new SettingsError('Choisissez un lien existant ou une nouvelle demande DocuSign.')
  }
  return { to, docusign: input.docusign, signatureLink: input.signatureLink, signerName: typeof input.signerName === 'string' ? input.signerName.trim() : '' }
}

async function context(sql: postgres.Sql, clientId: string, projectId: string, abby: AbbyConfig, value: unknown) {
  const input = validateQuoteEmailInput(value)
  const { client, project } = await getProject(sql, clientId, projectId)
  if (!project.quoteId) throw new SettingsError('Associez un devis Abby au projet avant de l’envoyer.', 409)
  if (!client.emails.some(email => email.trim().toLowerCase() === input.to)) throw new SettingsError('Choisissez une adresse e-mail enregistrée pour ce client dans Abby.')
  const settings = await getMailSettings(sql)
  if (!settings.configured) throw new SettingsError('Configurez SMTP dans les paramètres avant d’envoyer un devis.', 409)
  const quote = await fetchAbbyQuote(abby, client, project.quoteId)
  if (quote.state === 'draft') throw new SettingsError('Finalisez le devis dans Abby avant de l’envoyer.', 409)
  if (input.docusign && !(await getDocusignSettings(sql)).connected) throw new SettingsError('Connectez votre compte DocuSign dans les paramètres.', 409)
  const recipientName = input.signerName || client.name
  if (input.docusign && (!recipientName.trim() || recipientName.length > 100 || hasEmailControls(recipientName))) throw new SettingsError('Saisissez le nom du signataire (100 caractères maximum).')
  const variables: Record<EmailVariable, string> = {
    PROJECT_NAME: project.name, CLIENT_NAME: client.name, CLIENT_EMAIL: input.to,
    QUOTE_NUMBER: quote.number || '', QUOTE_TITLE: quote.title || '',
    QUOTE_AMOUNT: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: quote.currencyCode }).format(quote.amountWithTax / 100),
    SENDER_NAME: settings.fromName || settings.fromEmail, SIGNATURE_LINK: input.signatureLink
  }
  const subject = renderEmailTemplate(settings.subjectTemplate, variables, true)
  let text = renderEmailTemplate(settings.bodyTemplate, variables)
  if (input.signatureLink && !settings.bodyTemplate.includes('${SIGNATURE_LINK}')) text += `\n\nSignature électronique : ${input.signatureLink}`
  const filename = `devis-${(quote.number || quote.id).normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100)}.pdf`
  const preview = { quoteId: project.quoteId, to: input.to, subject, text, filename,
    from: settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail,
    replyTo: settings.replyTo, docusign: input.docusign, signerName: input.docusign ? recipientName : '' }
  if (input.docusign) envelopeDefinition({ ...preview, id: '', name: recipientName, pdf: Buffer.alloc(0) })
  return { preview: { ...preview, previewHash: hash(preview) }, recipientName, settings }
}

export async function previewQuoteEmail(sql: postgres.Sql, clientId: string, projectId: string, abby: AbbyConfig, value: unknown): Promise<QuoteEmailPreview> {
  return (await context(sql, clientId, projectId, abby, value)).preview
}

export async function getQuoteDeliveries(sql: postgres.Sql, clientId: string, projectId: string): Promise<QuoteDelivery[]> {
  await getProject(sql, clientId, projectId)
  // A process crash or network timeout must never appear as a confirmed failure:
  // SMTP/DocuSign might already have accepted the message.
  await sql`
    UPDATE quote_deliveries SET
      status = CASE WHEN status = 'sending' THEN 'uncertain' WHEN status = 'preparing' THEN 'failed' ELSE status END,
      signature_status = CASE WHEN signature_status = 'sending' THEN 'uncertain' ELSE signature_status END,
      error = 'Envoi interrompu. Vérifiez les messages envoyés et DocuSign avant tout nouvel envoi.', updated_at = now()
    WHERE project_id = ${projectId} AND updated_at < now() - interval '10 minutes'
      AND (status IN ('preparing', 'sending') OR signature_status = 'sending')
  `
  const rows = await sql<DeliveryRow[]>`
    SELECT id, quote_id, recipient, subject, created_at, status, signature_status, envelope_id, error
    FROM quote_deliveries WHERE project_id = ${projectId} ORDER BY created_at DESC LIMIT 20
  `
  return rows.map(delivery)
}

export const quoteEmailDependencies = { downloadPdf: downloadAbbyQuotePdf, mailer: mailTransport, sendEnvelope: sendDocusignEnvelope }

export async function requestDeliverySignature(sql: postgres.Sql, clientId: string, projectId: string, id: string, secret: string, dependencies = quoteEmailDependencies) {
  await getProject(sql, clientId, projectId)
  const [row] = await sql<DeliveryRow[]>`
    UPDATE quote_deliveries SET signature_status = 'sending', error = NULL, updated_at = now()
    WHERE id = ${id} AND project_id = ${projectId} AND status = 'sent'
      AND signature_status IN ('pending', 'failed') AND envelope_id IS NULL AND pdf IS NOT NULL RETURNING *
  `
  if (!row) throw new SettingsError('La demande de signature est déjà envoyée, en cours ou nécessite une vérification manuelle.', 409)
  try {
    const envelopeId = await dependencies.sendEnvelope(sql, secret, {
      id: row.id, to: row.recipient, name: row.recipient_name, subject: row.subject, text: row.body, filename: row.filename, pdf: row.pdf!
    })
    const [result] = await sql<DeliveryRow[]>`
      UPDATE quote_deliveries SET signature_status = 'sent', envelope_id = ${envelopeId}, pdf = NULL, error = NULL, updated_at = now() WHERE id = ${id} RETURNING *
    `
    return delivery(result!)
  } catch (error) {
    // A timeout can occur after DocuSign sent the invitation. Do not auto-retry.
    const uncertain = !(error instanceof SettingsError) || error.message.includes('pas confirmé')
    const [result] = await sql<DeliveryRow[]>`
      UPDATE quote_deliveries SET signature_status = ${uncertain ? 'uncertain' : 'failed'},
        error = ${error instanceof SettingsError ? error.message : 'DocuSign n’a pas confirmé l’envoi. Vérifiez votre compte.'}, updated_at = now() WHERE id = ${id} RETURNING *
    `
    return delivery(result!)
  }
}

export async function sendQuoteEmail(sql: postgres.Sql, clientId: string, projectId: string, abby: AbbyConfig, value: unknown, secret: string, dependencies = quoteEmailDependencies) {
  const input = value as Record<string, unknown> | null
  if (!input || typeof input.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)
    || typeof input.previewHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.previewHash)) throw new SettingsError('Actualisez l’aperçu avant d’envoyer le devis.')
  const id = input.id
  const options = validateQuoteEmailInput(value)
  const requestHash = hash({ ...options, previewHash: input.previewHash })
  await getProject(sql, clientId, projectId)
  const [existing] = await sql<DeliveryRow[]>`SELECT * FROM quote_deliveries WHERE id = ${id}`
  if (existing) {
    if (existing.project_id !== projectId || existing.request_hash !== requestHash) throw new SettingsError('Cet identifiant d’envoi a déjà été utilisé pour un autre message.', 409)
    return delivery(existing)
  }
  const { preview, recipientName, settings } = await context(sql, clientId, projectId, abby, value)
  if (input.previewHash !== preview.previewHash) throw new SettingsError('Le devis ou le modèle a changé. Actualisez l’aperçu avant d’envoyer.', 409)
  const claimed = await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${projectId}, 401))`
    const [{ count } = { count: 0 }] = await transaction`SELECT count(*)::integer AS count FROM quote_deliveries WHERE project_id = ${projectId} AND created_at > now() - interval '1 minute'`
    if (count >= 5) throw new SettingsError('Limite de cinq envois par minute atteinte pour ce projet.', 429)
    return transaction<DeliveryRow[]>`
      INSERT INTO quote_deliveries (id, project_id, quote_id, recipient, recipient_name, subject, body, filename, request_hash, signature_status)
      VALUES (${id}, ${projectId}, ${preview.quoteId}, ${preview.to}, ${recipientName}, ${preview.subject}, ${preview.text}, ${preview.filename}, ${requestHash}, ${options.docusign ? 'pending' : 'none'})
      ON CONFLICT (id) DO NOTHING RETURNING *
    `
  })
  if (!claimed.length) {
    const [row] = await sql<DeliveryRow[]>`SELECT * FROM quote_deliveries WHERE id = ${id} AND project_id = ${projectId} AND request_hash = ${requestHash}`
    if (!row) throw new SettingsError('Cet identifiant d’envoi est déjà utilisé.', 409)
    return delivery(row)
  }
  let sending = false
  try {
    const pdf = await dependencies.downloadPdf(abby, preview.quoteId)
    const { transport } = await dependencies.mailer(sql, secret)
    try {
      // Verify the connection before marking a delivery as potentially sent.
      await transport.verify()
      await sql`UPDATE quote_deliveries SET status = 'sending', pdf = ${options.docusign ? pdf : null}, updated_at = now() WHERE id = ${id}`
      sending = true
      const info = await transport.sendMail({
        from: { name: settings.fromName, address: settings.fromEmail }, to: preview.to, replyTo: settings.replyTo || undefined,
        subject: preview.subject, text: preview.text,
        messageId: `<${id}@${settings.fromEmail.split('@')[1]}>`,
        attachments: [{ filename: preview.filename, content: pdf, contentType: 'application/pdf' }],
        disableFileAccess: true, disableUrlAccess: true
      })
      if (!info.accepted?.length || info.rejected?.length) throw new Error('Recipient not accepted')
      await sql`UPDATE quote_deliveries SET status = 'sent', error = NULL, updated_at = now() WHERE id = ${id}`
    } finally {
      transport.close()
    }
  } catch (error) {
    const message = sending
      ? 'Le serveur SMTP n’a pas confirmé la remise. Vérifiez les messages envoyés avant de renvoyer.'
      : error instanceof SettingsError || error instanceof AbbySyncError ? error.message : 'Envoi impossible. Vérifiez la connexion SMTP et le PDF Abby.'
    const [result] = await sql<DeliveryRow[]>`
      UPDATE quote_deliveries SET status = ${sending ? 'uncertain' : 'failed'}, error = ${message},
        pdf = NULL, updated_at = now() WHERE id = ${id} RETURNING *
    `
    return delivery(result!)
  }
  if (options.docusign) return requestDeliverySignature(sql, clientId, projectId, id, secret, dependencies)
  const [result] = await sql<DeliveryRow[]>`SELECT * FROM quote_deliveries WHERE id = ${id}`
  return delivery(result!)
}
