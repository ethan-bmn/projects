import { describe, expect, it } from 'vitest'
import { validateProspectInput } from '../../server/services/prospects'

const input = { name: ' Atelier Martin ', domain: ' Artisanat ', email: ' contact@example.fr ', phone: '', websiteUrl: ' https://example.fr/contact ' }

describe('prospect validation', () => {
  it('trims input and accepts either contact method without a website', () => {
    expect(validateProspectInput(input)).toEqual({ name: 'Atelier Martin', domain: 'Artisanat', email: 'contact@example.fr', phone: '', websiteUrl: 'https://example.fr/contact', idea: '' })
    expect(validateProspectInput({ ...input, email: '', phone: '+33 (0)6 12 34 56 78', websiteUrl: '' })).toMatchObject({ email: '', phone: '+33 (0)6 12 34 56 78', websiteUrl: null })
    expect(validateProspectInput({ name: 'Test', domain: 'Conseil', email: 'a@example.fr' })).toMatchObject({ phone: '', websiteUrl: null })
  })

  it('preserves multiline ideas while trimming surrounding whitespace', () => {
    expect(validateProspectInput({ ...input, idea: '  Site vitrine\nPrise de rendez-vous  ' }).idea)
      .toBe('Site vitrine\nPrise de rendez-vous')
    expect(validateProspectInput({ ...input, idea: 'x'.repeat(5000) }).idea).toHaveLength(5000)
  })

  it.each([undefined, null, '', '   '])('accepts an optional blank idea: %j', (idea) => {
    expect(validateProspectInput({ ...input, idea }).idea).toBe('')
  })

  it.each([
    null, [], 'invalid',
    { ...input, idea: 'x'.repeat(5001) }, { ...input, idea: 42 }, { ...input, idea: ['Site web'] },
    { ...input, name: ' ' }, { ...input, name: 'x'.repeat(201) },
    { ...input, domain: '' }, { ...input, domain: 'x'.repeat(201) },
    { ...input, email: '', phone: ' ' }, { ...input, email: 'invalid' },
    { ...input, email: 123 }, { ...input, phone: 'call me' }, { ...input, phone: '+' },
    { ...input, phone: '1'.repeat(51) }, { ...input, websiteUrl: 'example.fr' },
    { ...input, websiteUrl: 'javascript:alert(1)' }, { ...input, websiteUrl: 'ftp://example.fr' },
    { ...input, websiteUrl: 'https://user:password@example.fr' },
    { ...input, websiteUrl: `https://example.fr/${'a'.repeat(2048)}` }
  ])('rejects invalid or unsafe input %#', (value) => {
    expect(() => validateProspectInput(value)).toThrow()
  })
})
