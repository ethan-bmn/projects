import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateDatabase } from '../../database/setup'
import { fetchAbbyQuote } from '../../server/services/abby-quotes'
import type { mailTransport } from '../../server/services/mail-settings'
import { getMailSettings, saveMailSettings } from '../../server/services/mail-settings'
import { decryptSetting } from '../../server/services/settings-secrets'
import { getQuoteDeliveries, previewQuoteEmail, quoteEmailDependencies, requestDeliverySignature, sendQuoteEmail } from '../../server/services/quote-email'
import { SettingsError } from '../../server/services/settings'
import { saveDocumensoSettings } from '../../server/services/documenso'
import { createTestDatabase } from '../helpers/database'
import { mailSettingsInput, settingsSecret } from '../helpers/email'

vi.mock('../../server/services/abby-quotes', async original => ({ ...await original<typeof import('../../server/services/abby-quotes')>(), fetchAbbyQuote: vi.fn() }))

const database = await createTestDatabase()
afterAll(database.cleanup)
const sql = database.sql
const abby = { baseUrl: 'https://api.app-abby.com', apiKey: 'fixture' }
const options = { to: 'client@example.test', documenso: false, signatureLink: '' }
let clientId: string
let projectId: string
const transport = { verify: vi.fn(), sendMail: vi.fn(), close: vi.fn() }
const dependencies = {
  ...quoteEmailDependencies,
  downloadPdf: vi.fn<typeof quoteEmailDependencies.downloadPdf>(),
  mailer: vi.fn<typeof mailTransport>(),
  sendEnvelope: vi.fn<typeof quoteEmailDependencies.sendEnvelope>()
}

beforeEach(async () => {
  vi.clearAllMocks()
  await sql`TRUNCATE quote_deliveries, projects, clients`
  const [client] = await sql`INSERT INTO clients (abby_id, kind, name, emails) VALUES ('abby-client', 'individual', 'Émilie Martin', ARRAY['client@example.test']) RETURNING id`
  clientId = client!.id
  const [project] = await sql`INSERT INTO projects (client_id, name, quote_id) VALUES (${clientId}, 'Refonte du site', 'quote-1') RETURNING id`
  projectId = project!.id
  await saveMailSettings(sql, mailSettingsInput, settingsSecret)
  await saveDocumensoSettings(sql, { apiToken: 'api_test' }, settingsSecret)
  vi.mocked(fetchAbbyQuote).mockResolvedValue({ id: 'quote-1', number: 'D-001', title: 'Site web', state: 'finalized', amountWithTax: 120000, currencyCode: 'EUR' })
  transport.verify.mockResolvedValue(true)
  transport.sendMail.mockResolvedValue({ accepted: ['client@example.test'], rejected: [] })
  dependencies.downloadPdf.mockResolvedValue(Buffer.from('%PDF-1.7\nfixture'))
  dependencies.mailer.mockResolvedValue({ settings: await getMailSettings(sql), transport: transport as unknown as Awaited<ReturnType<typeof mailTransport>>['transport'] })
  dependencies.sendEnvelope.mockResolvedValue('envelope-fixture')
})

async function prepared(changes = {}) {
  const input = { ...options, ...changes }
  const preview = await previewQuoteEmail(sql, clientId, projectId, abby, input)
  return { ...input, id: randomUUID(), previewHash: preview.previewHash }
}

describe('quote delivery', () => {
  it('persists settings without exposing secrets, preserves blank password inputs and survives migration reruns', async () => {
    const publicSettings = await getMailSettings(sql)
    expect(JSON.stringify(publicSettings)).not.toContain(mailSettingsInput.smtpPassword)
    expect(publicSettings.smtpPasswordConfigured).toBe(true)
    await saveMailSettings(sql, { ...mailSettingsInput, smtpPassword: '', subjectTemplate: 'Devis ${PROJECT_NAME}' }, settingsSecret)
    await migrateDatabase(sql)
    const [row] = await sql`SELECT smtp_password, subject_template FROM mail_settings WHERE id = 1`
    expect(decryptSetting(row!.smtp_password, settingsSecret)).toBe(mailSettingsInput.smtpPassword)
    expect(row!.subject_template).toBe('Devis ${PROJECT_NAME}')
  })

  it('previews dynamic content and attaches the PDF once even when the same send request is repeated', async () => {
    const input = await prepared()
    const preview = await previewQuoteEmail(sql, clientId, projectId, abby, options)
    expect(preview.subject).toContain('Refonte du site')
    expect(preview.text).toContain('Émilie Martin')
    const first = await sendQuoteEmail(sql, clientId, projectId, abby, input, settingsSecret, dependencies)
    const repeated = await sendQuoteEmail(sql, clientId, projectId, abby, input, settingsSecret, dependencies)
    expect(first.status).toBe('sent')
    expect(repeated.id).toBe(first.id)
    expect(transport.sendMail).toHaveBeenCalledTimes(1)
    expect(transport.sendMail.mock.calls[0]![0]).toMatchObject({ to: options.to, subject: preview.subject, text: preview.text,
      attachments: [{ content: Buffer.from('%PDF-1.7\nfixture'), contentType: 'application/pdf', filename: 'devis-D-001.pdf' }] })
    expect(dependencies.sendEnvelope).not.toHaveBeenCalled()
    const [row] = await sql`SELECT pdf FROM quote_deliveries WHERE id = ${first.id}`
    expect(row!.pdf).toBeNull()
  })

  it('rejects unreviewed template changes, a different recipient, draft devis and another customer’s project', async () => {
    const input = await prepared()
    await saveMailSettings(sql, { ...mailSettingsInput, subjectTemplate: 'Modifié ${PROJECT_NAME}' }, settingsSecret)
    await expect(sendQuoteEmail(sql, clientId, projectId, abby, input, settingsSecret, dependencies)).rejects.toThrow('changé')
    await expect(previewQuoteEmail(sql, clientId, projectId, abby, { ...options, to: 'other@example.test' })).rejects.toThrow('adresse')
    await expect(previewQuoteEmail(sql, randomUUID(), projectId, abby, options)).rejects.toMatchObject({ statusCode: 404 })
    vi.mocked(fetchAbbyQuote).mockResolvedValueOnce({ id: 'quote-1', number: null, title: null, state: 'draft', amountWithTax: 0, currencyCode: 'EUR' })
    await expect(previewQuoteEmail(sql, clientId, projectId, abby, options)).rejects.toThrow('Finalisez')
    expect(transport.sendMail).not.toHaveBeenCalled()
  })

  it('claims a concurrent repeated request once and refuses a changed request using the same ID', async () => {
    const input = await prepared()
    const results = await Promise.all([
      sendQuoteEmail(sql, clientId, projectId, abby, input, settingsSecret, dependencies),
      sendQuoteEmail(sql, clientId, projectId, abby, input, settingsSecret, dependencies)
    ])
    expect(results.map(result => result.id)).toEqual([input.id, input.id])
    expect(transport.sendMail).toHaveBeenCalledTimes(1)
    await expect(sendQuoteEmail(sql, clientId, projectId, abby, { ...input, signatureLink: 'https://example.test/sign' }, settingsSecret, dependencies)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('limits new send attempts per project while still allowing an existing request to be rechecked', async () => {
    const first = await prepared()
    await sendQuoteEmail(sql, clientId, projectId, abby, first, settingsSecret, dependencies)
    for (let index = 0; index < 4; index++) await sendQuoteEmail(sql, clientId, projectId, abby, await prepared(), settingsSecret, dependencies)
    await expect(sendQuoteEmail(sql, clientId, projectId, abby, await prepared(), settingsSecret, dependencies)).rejects.toMatchObject({ statusCode: 429 })
    expect((await sendQuoteEmail(sql, clientId, projectId, abby, first, settingsSecret, dependencies)).status).toBe('sent')
    expect(transport.sendMail).toHaveBeenCalledTimes(5)
  })

  it('does not send mail if the PDF download or SMTP verification fails', async () => {
    const input = await prepared()
    dependencies.downloadPdf.mockRejectedValueOnce(new Error('Unavailable'))
    expect((await sendQuoteEmail(sql, clientId, projectId, abby, input, settingsSecret, dependencies)).status).toBe('failed')
    transport.verify.mockRejectedValueOnce(new Error('Invalid password'))
    expect((await sendQuoteEmail(sql, clientId, projectId, abby, await prepared(), settingsSecret, dependencies)).status).toBe('failed')
    expect(transport.sendMail).not.toHaveBeenCalled()
  })

  it('records ambiguous SMTP results and does not retry them automatically', async () => {
    const input = await prepared()
    transport.sendMail.mockRejectedValueOnce(new Error('socket timeout'))
    const result = await sendQuoteEmail(sql, clientId, projectId, abby, input, settingsSecret, dependencies)
    expect(result.status).toBe('uncertain')
    await sendQuoteEmail(sql, clientId, projectId, abby, input, settingsSecret, dependencies)
    expect(transport.sendMail).toHaveBeenCalledTimes(1)
  })

  it('retries a rejected signature invitation without sending the SMTP email again', async () => {
    const input = await prepared({ documenso: true })
    dependencies.sendEnvelope.mockRejectedValueOnce(new SettingsError('Reconnectez votre compte Documenso.', 502))
    const first = await sendQuoteEmail(sql, clientId, projectId, abby, input, settingsSecret, dependencies)
    expect(first).toMatchObject({ status: 'sent', signatureStatus: 'failed' })
    const second = await requestDeliverySignature(sql, clientId, projectId, first.id, settingsSecret, dependencies)
    expect(second).toMatchObject({ status: 'sent', signatureStatus: 'sent', envelopeId: 'envelope-fixture' })
    expect(transport.sendMail).toHaveBeenCalledTimes(1)
    expect(dependencies.sendEnvelope).toHaveBeenCalledTimes(2)
    await expect(requestDeliverySignature(sql, clientId, projectId, first.id, settingsSecret, dependencies)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('does not retry an unconfirmed signature request and recovers stale interrupted deliveries as uncertain', async () => {
    dependencies.sendEnvelope.mockRejectedValueOnce(new Error('socket timeout'))
    const result = await sendQuoteEmail(sql, clientId, projectId, abby, await prepared({ documenso: true }), settingsSecret, dependencies)
    expect(result.signatureStatus).toBe('uncertain')
    await expect(requestDeliverySignature(sql, clientId, projectId, result.id, settingsSecret, dependencies)).rejects.toMatchObject({ statusCode: 409 })
    await sql`UPDATE quote_deliveries SET status = 'sending', updated_at = now() - interval '11 minutes' WHERE id = ${result.id}`
    expect((await getQuoteDeliveries(sql, clientId, projectId))[0]!.status).toBe('uncertain')
  })

  it('reuses the persisted draft after a rejected invitation without resending SMTP', async () => {
    dependencies.sendEnvelope.mockImplementationOnce(async (_sql, _secret, input) => {
      await input.onCreated?.('envelope_draft')
      throw new SettingsError('Documenso a refusé la requête.', 502)
    })
    const result = await sendQuoteEmail(sql, clientId, projectId, abby, await prepared({ documenso: true }), settingsSecret, dependencies)
    expect(result).toMatchObject({ signatureStatus: 'failed', envelopeId: 'envelope_draft', signatureProvider: 'documenso' })
    await requestDeliverySignature(sql, clientId, projectId, result.id, settingsSecret, dependencies)
    expect(dependencies.sendEnvelope.mock.calls[1]![2].envelopeId).toBe('envelope_draft')
    expect(transport.sendMail).toHaveBeenCalledTimes(1)
  })

  it('preserves DocuSign history and refuses to retry it through Documenso', async () => {
    dependencies.sendEnvelope.mockRejectedValueOnce(new SettingsError('Rejected', 502))
    const result = await sendQuoteEmail(sql, clientId, projectId, abby, await prepared({ documenso: true }), settingsSecret, dependencies)
    await sql`UPDATE quote_deliveries SET signature_provider = 'docusign', envelope_id = 'old-envelope' WHERE id = ${result.id}`
    expect((await getQuoteDeliveries(sql, clientId, projectId))[0]).toMatchObject({ signatureProvider: 'docusign', envelopeId: 'old-envelope' })
    await expect(requestDeliverySignature(sql, clientId, projectId, result.id, settingsSecret, dependencies)).rejects.toMatchObject({ statusCode: 409 })
    expect(dependencies.sendEnvelope).toHaveBeenCalledTimes(1)
  })

  it('adds an optional existing signature link to the rendered message', async () => {
    const preview = await previewQuoteEmail(sql, clientId, projectId, abby, { ...options, signatureLink: 'https://apps.documenso.com/sign/fixture' })
    expect(preview.text).toContain('Signature électronique : https://apps.documenso.com/sign/fixture')
  })
})
