import { quoteMetadataFromText } from '#shared/utils/quote-reference'
import type { QuoteMetadata } from '#shared/utils/quote-reference'

export async function extractQuoteMetadata(bytes: Uint8Array): Promise<QuoteMetadata> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true, useSystemFonts: false })
  try {
    const pdf = await task.promise
    const texts: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items.map(item => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join('')
      texts.push(text)
      page.cleanup()
    }
    return quoteMetadataFromText(texts.join('\n'))
  } finally {
    await task.destroy()
  }
}

export async function extractQuoteReference(bytes: Uint8Array): Promise<string | null> {
  return (await extractQuoteMetadata(bytes)).reference
}
