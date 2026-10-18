export function annexMetadata(type: 'hosting' | 'gdpr', contractReference: string) {
  const reference = contractReference.trim()
  return {
    reference: reference ? `ANN-${type === 'hosting' ? 'HEB' : 'RGPD'}-${reference}` : '',
    version: '1'
  }
}
