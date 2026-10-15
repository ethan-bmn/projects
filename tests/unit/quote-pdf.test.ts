import { jsPDF } from 'jspdf'
import { describe, expect, it, vi } from 'vitest'
import { extractQuoteReference } from '../../app/lib/quote-reference'

// The browser uses the bundled worker URL; Node's PDF.js worker needs its file URL.
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
}))

describe('quote PDF text reading', () => {
  it('reads the number from a real PDF and preserves the attachment bytes', async () => {
    const pdf = new jsPDF()
    pdf.text('Devis', 20, 20)
    pdf.text('N° DEV-2026-0042', 20, 30)
    const bytes = new Uint8Array(pdf.output('arraybuffer'))
    const original = bytes.slice()
    expect(await extractQuoteReference(bytes)).toBe('DEV-2026-0042')
    expect(bytes).toEqual(original)
  })

  it('returns null for an attachment without text and finds references on later pages', async () => {
    const pdf = new jsPDF()
    expect(await extractQuoteReference(new Uint8Array(pdf.output('arraybuffer')))).toBeNull()
    pdf.addPage()
    pdf.text('Quote # Q20260042', 20, 20)
    expect(await extractQuoteReference(new Uint8Array(pdf.output('arraybuffer')))).toBe('Q20260042')
  })
})
