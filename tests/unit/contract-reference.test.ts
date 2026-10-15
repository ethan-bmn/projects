import { describe, expect, it } from 'vitest'
import { contractReferenceFromQuote, syncContractReference } from '../../shared/utils/contract-reference'

describe('contract reference generation', () => {
  it('generates a stable reference from the full quote reference and leaves unknown quotes blank', () => {
    expect(contractReferenceFromQuote(' DEV-2026-0042 ')).toBe('CTR-DEV-2026-0042')
    expect(contractReferenceFromQuote('2026/0042')).toBe('CTR-2026/0042')
    expect(contractReferenceFromQuote('  ')).toBe('')
  })

  it('fills and updates generated references when the quote changes, including a replacement upload', () => {
    const fields = { 'devis.reference': 'DEV-001', 'contrat.reference': '' }
    syncContractReference(fields)
    expect(fields['contrat.reference']).toBe('CTR-DEV-001')
    fields['devis.reference'] = ''
    syncContractReference(fields, 'DEV-001')
    expect(fields['contrat.reference']).toBe('')
    fields['devis.reference'] = 'DEV-002'
    syncContractReference(fields)
    expect(fields['contrat.reference']).toBe('CTR-DEV-002')
  })

  it('preserves a custom contract reference when a quote is changed or reread', () => {
    const fields = { 'devis.reference': 'DEV-002', 'contrat.reference': 'CUSTOM-2026-001' }
    syncContractReference(fields, 'DEV-001')
    expect(fields['contrat.reference']).toBe('CUSTOM-2026-001')
    syncContractReference(fields)
    expect(fields['contrat.reference']).toBe('CUSTOM-2026-001')
  })
})
