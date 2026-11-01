import { describe, expect, it } from 'vitest'
import { validateQuoteEmailInput } from '../../server/services/quote-email'

describe('quote email input', () => {
  it('validates optional HTTPS signature links without accepting credentials or script URLs', () => {
    expect(validateQuoteEmailInput({ to: 'client@example.test', docusign: false, signatureLink: 'https://apps.docusign.com/sign/123' }).signatureLink).toContain('docusign')
    for (const signatureLink of ['javascript:alert(1)', 'http://example.test', 'https://user:pass@example.test']) {
      expect(() => validateQuoteEmailInput({ to: 'client@example.test', docusign: false, signatureLink })).toThrow()
    }
    expect(() => validateQuoteEmailInput({ to: 'client@example.test', docusign: true, signatureLink: 'https://example.test' })).toThrow()
  })

  it('rejects header injection and overlong signer names', () => {
    for (const signerName of ['Signer\r\nBcc: other@example.test', 'x'.repeat(101)]) {
      expect(() => validateQuoteEmailInput({ to: 'client@example.test', docusign: true, signatureLink: '', signerName })).toThrow()
    }
  })
})
