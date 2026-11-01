import { describe, expect, it } from 'vitest'
import { docusignBaseUri, envelopeDefinition } from '../../server/services/docusign'

describe('DocuSign envelope', () => {
  const input = { id: 'transaction-1', to: 'client@example.test', name: 'Client', subject: 'Votre devis', text: 'Bonjour', filename: 'devis.pdf', pdf: Buffer.from('%PDF-1.7\nfixture') }

  it('sends the original PDF for remote signing with an idempotency transaction ID', () => {
    const envelope = envelopeDefinition(input)
    expect(envelope).toMatchObject({ status: 'sent', transactionId: input.id, emailSubject: input.subject, emailBlurb: input.text })
    expect(envelope.documents[0]!.documentBase64).toBe(input.pdf.toString('base64'))
    expect(envelope.recipients.signers[0]).toEqual({ email: input.to, name: input.name, recipientId: '1', routingOrder: '1' })
  })

  it('rejects overlong notification content and untrusted API base URIs', () => {
    expect(() => envelopeDefinition({ ...input, subject: 'x'.repeat(101) })).toThrow('100')
    expect(() => envelopeDefinition({ ...input, text: 'x'.repeat(10001) })).toThrow('10 000')
    expect(docusignBaseUri('https://demo.docusign.net/')).toBe('https://demo.docusign.net')
    for (const url of ['http://demo.docusign.net', 'https://demo.docusign.net.evil.test', 'https://user:pass@demo.docusign.net', 'https://demo.docusign.net/other']) {
      expect(() => docusignBaseUri(url)).toThrow()
    }
  })
})
