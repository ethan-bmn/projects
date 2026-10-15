import { describe, expect, it } from 'vitest'
import { quoteReferenceFromText } from '../../shared/utils/quote-reference'

describe('quote PDF reference extraction', () => {
  it.each([
    ['Devis n° DEV-2026-001\nDate : 15/10/2026', 'DEV-2026-001'],
    ['DEVIS N°\nD20260042', 'D20260042'],
    ['Numéro de devis : 2026/0042', '2026/0042'],
    ['Référence du devis : Q-2026-123', 'Q-2026-123'],
    ['Devis : DE–2026–007', 'DE-2026-007'],
    ['Devis\n2026-001', '2026-001'],
    ['Quote # Q-2026-001', 'Q-2026-001'],
    ['Devis nº 0042', '0042'],
    ['Devis N° D.2026.042', 'D.2026.042']
  ])('finds the labeled reference in %s', (text, expected) => {
    expect(quoteReferenceFromText(text)).toBe(expected)
  })

  it.each(['', 'Devis pour la création du site', 'Facture N° F2026-01', 'Devis\n15/10/2026', 'Date : 15/10/2026\nTotal : 1000'])('leaves missing or ambiguous references for manual entry: %s', (text) => {
    expect(quoteReferenceFromText(text)).toBeNull()
  })
})
