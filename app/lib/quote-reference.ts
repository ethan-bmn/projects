import { quoteReferenceFromText } from '#shared/utils/quote-reference'

export async function extractQuoteReference(bytes: Uint8Array): Promise<string | null> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true, useSystemFonts: false })
  try {
    const pdf = await task.promise
    // Quote identifiers are normally in the first-page header; bound extraction for large attachments.
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 3); pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items.map(item => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join('')
      const reference = quoteReferenceFromText(text)
      page.cleanup()
      if (reference) return reference
    }
    return null
  } finally {
    await task.destroy()
  }
}
