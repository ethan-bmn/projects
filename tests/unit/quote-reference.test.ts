import { describe, expect, it } from 'vitest'
import { quoteIssueDateFromText, quoteMetadataFromText, quoteReferenceFromText } from '../../shared/utils/quote-reference'

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

describe('quote issue date extraction', () => {
  it.each([
    ['Date d’émission : 15/10/2026', '15/10/2026'],
    ['Date d\'emission\n2026-10-15', '15/10/2026'],
    ['Date du devis : 5.2.2026', '05/02/2026'],
    ['Émis le : 1er février 2026', '01/02/2026'],
    ['Établi le 29 février 2024', '29/02/2024'],
    ['Date de création : 15 août 2026', '15/08/2026'],
    ['Date : 15-10-2026', '15/10/2026'],
    ['Issue date: 2026/10/15', '15/10/2026'],
    ['Date : 01/11/2026\nDate d’émission : 15/10/2026', '15/10/2026'],
    ['Valable jusqu’au 15/11/2026\nDate : 15/10/2026', '15/10/2026']
  ])('reads and normalizes %s', (text, expected) => {
    expect(quoteIssueDateFromText(text)).toBe(expected)
  })

  it.each(['', 'Date de validité : 15/11/2026', 'Date d’échéance : 15/11/2026', 'Date limite : 15/11/2026', 'Date : 31/02/2026', 'Date : 29/02/2025', 'Date : 10/13/2026', 'Devis n° D20261015'])('does not invent an issue date for %s', (text) => {
    expect(quoteIssueDateFromText(text)).toBeNull()
  })

  it('returns both independent metadata values', () => {
    expect(quoteMetadataFromText('Devis n° DEV-2026-42\nDate d’émission : 15/10/2026')).toEqual({ reference: 'DEV-2026-42', issueDate: '15/10/2026' })
  })
})
