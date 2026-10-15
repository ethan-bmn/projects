export function quoteReferenceFromText(value: string): string | null {
  const text = value.normalize('NFKC').replace(/[\u2010-\u2015]/g, '-').replace(/\u00a0/g, ' ')
  const labels = [
    /(?:num[ée]ro|r[ée]f[ée]rence|n[°ºo.]?)\s*(?:du?\s+)?(?:devis|quote|quotation)\s*[:#-]?\s*([\w][\w./-]{0,99})/gi,
    /(?:devis|quote|quotation)\s*(?:(?:n\s*[°ºo.]?|num[ée]ro|r[ée]f[ée]rence|ref\.?)\s*)?[:#-]?\s*([\w][\w./-]{0,99})/gi
  ]
  for (const pattern of labels) {
    for (const match of text.matchAll(pattern)) {
      const reference = match[1]!.replace(/[./-]+$/, '')
      if (/\d/.test(reference) && !/^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(reference)) return reference
    }
  }
  return null
}
