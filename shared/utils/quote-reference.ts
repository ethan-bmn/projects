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

export interface QuoteMetadata {
  reference: string | null
  issueDate: string | null
}

export function quoteIssueDateFromText(value: string): string | null {
  const text = value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[’‘]/g, '\'').toLowerCase()
  const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']
  const datePattern = '(\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}|\\d{1,2}(?:er)?\\s+(?:' + months.join('|') + ')\\s+\\d{4})'
  const labels = [
    '(?:date\\s+d[\' ]?emission|date\\s+d[\' ]?edition|date\\s+de\\s+creation|date\\s+(?:du|de)\\s+devis|emis\\s+le|etabli\\s+le|issue\\s+date|date\\s+issued|issued\\s+(?:on|at)|devis\\s+du)',
    '\\bdate'
  ]
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:：-]?\\s*${datePattern}(?!\\d)`, 'g')
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1]!
      let day: number
      let month: number
      let year: number
      if (/^\d{4}/.test(candidate)) {
        [year, month, day] = candidate.split(/[-/]/).map(Number) as [number, number, number]
      } else if (/^\d+[/.-]/.test(candidate)) {
        [day, month, year] = candidate.split(/[/.-]/).map(Number) as [number, number, number]
      } else {
        const parts = candidate.split(/\s+/)
        day = Number.parseInt(parts[0]!)
        month = months.indexOf(parts[1]!) + 1
        year = Number(parts[2])
      }
      const parsed = new Date(Date.UTC(year, month - 1, day))
      if (year >= 1900 && year <= 2199 && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) {
        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
      }
    }
  }
  return null
}

export function quoteMetadataFromText(value: string): QuoteMetadata {
  return { reference: quoteReferenceFromText(value), issueDate: quoteIssueDateFromText(value) }
}
