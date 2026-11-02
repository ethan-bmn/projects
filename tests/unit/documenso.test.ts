import type postgres from 'postgres'
import { describe, expect, it, vi } from 'vitest'
import { documensoOrigin, envelopeDefinition, sendDocumensoEnvelope } from '../../server/services/documenso'
import { encryptSetting } from '../../server/services/settings-secrets'
import { settingsSecret } from '../helpers/email'

const input = { id: 'transaction-1', to: 'client@example.test', name: 'Client', subject: 'Votre devis', text: 'Bonjour', filename: 'devis.pdf', pdf: Buffer.from('%PDF-1.7\nfixture') }
const sql = vi.fn().mockResolvedValue([{ api_token: encryptSetting('api_test', settingsSecret) }]) as unknown as postgres.Sql

describe('Documenso invitations', () => {
  it('uploads the unchanged quote and a signature sheet, persists the draft, then distributes it', async () => {
    const onCreated = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: 'envelope_test' }))
      .mockImplementationOnce(async () => {
        expect(onCreated).toHaveBeenCalledWith('envelope_test')
        return Response.json({ success: true, id: 'envelope_test', recipients: [] })
      })
    expect(await sendDocumensoEnvelope(sql, settingsSecret, { ...input, onCreated }, request)).toBe('envelope_test')
    const [url, init] = request.mock.calls[0]!
    expect(String(url)).toContain('/api/v2/envelope/create')
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: { Authorization: 'api_test' } })
    const form = init!.body as FormData
    const definition = JSON.parse(String(form.get('payload')))
    expect(definition).toMatchObject({ type: 'DOCUMENT', externalId: input.id, meta: { subject: input.subject, distributionMethod: 'EMAIL' } })
    expect(definition.recipients[0]).toMatchObject({ email: input.to, name: input.name, role: 'SIGNER', fields: [{ type: 'SIGNATURE', identifier: 1, page: 1 }] })
    const files = form.getAll('files') as File[]
    expect(files).toHaveLength(2)
    expect(Buffer.from(await files[0]!.arrayBuffer())).toEqual(input.pdf)
    expect(await files[1]!.text()).toContain('Signature du devis')
    expect(await files[1]!.text()).toContain(input.id)
    expect(JSON.parse(String(request.mock.calls[1]![1]!.body))).toEqual({ envelopeId: 'envelope_test' })
  })

  it('reuses a saved draft rather than creating another envelope', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, id: 'envelope_saved' }))
    expect(await sendDocumensoEnvelope(sql, settingsSecret, { ...input, envelopeId: 'envelope_saved' }, request)).toBe('envelope_saved')
    expect(request).toHaveBeenCalledTimes(1)
    expect(String(request.mock.calls[0]![0])).toContain('/envelope/distribute')
  })

  it('does not distribute when persisting the draft fails', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 'envelope_test' }))
    await expect(sendDocumensoEnvelope(sql, settingsSecret, {
      ...input, onCreated: async () => { throw new Error('Database unavailable') }
    }, request)).rejects.toThrow('Database unavailable')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it.each([401, 403, 422, 500, 408])('reports HTTP %s without exposing response bodies or tokens', async (status) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('private-provider-response', { status }))
    await expect(sendDocumensoEnvelope(sql, settingsSecret, input, request)).rejects.toThrow(status >= 500 || status === 408 ? 'pas confirmé' : status === 401 || status === 403 ? 'clé API' : 'refusé')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('treats network timeouts and malformed success responses as uncertain', async () => {
    for (const request of [
      vi.fn<typeof fetch>().mockRejectedValue(new Error('private network details')),
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 'unexpected' })),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('not json')),
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 'envelope_saved', success: false }))
    ]) {
      await expect(sendDocumensoEnvelope(sql, settingsSecret, { ...input, envelopeId: 'envelope_saved' }, request)).rejects.toThrow('pas confirmé')
    }
  })

  it('enforces notification limits and rejects malformed instance URLs', () => {
    expect(() => envelopeDefinition({ ...input, subject: 'x'.repeat(255) })).toThrow('254')
    expect(() => envelopeDefinition({ ...input, text: 'x'.repeat(5001) })).toThrow('5 000')
    expect(documensoOrigin('http://documenso:3000')).toBe('http://documenso:3000')
    for (const value of ['ftp://host', 'https://user:pass@host', 'https://host/path', 'https://host?token=secret']) {
      expect(() => documensoOrigin(value)).toThrow()
    }
  })
})
