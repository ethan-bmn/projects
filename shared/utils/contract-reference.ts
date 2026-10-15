export function contractReferenceFromQuote(quoteReference: string) {
  const reference = quoteReference.trim()
  return reference ? `CTR-${reference}` : ''
}

export function syncContractReference(fields: Record<string, string>, previousQuoteReference = '') {
  const current = fields['contrat.reference']?.trim() ?? ''
  if (!current || current === contractReferenceFromQuote(previousQuoteReference)) {
    fields['contrat.reference'] = contractReferenceFromQuote(fields['devis.reference'] ?? '')
  }
}
