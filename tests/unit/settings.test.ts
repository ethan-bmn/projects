import { describe, expect, it } from 'vitest'
import { validateAbbyKey, validateAccount, validateProvider } from '../../server/services/settings'

const profile = { name: 'Atelier Test', siren: '123456789', address: '12 rue du Test', email: 'contact@example.test', phone: '' }

describe('settings validation', () => {
  it('normalizes contact details without requiring an optional phone', () => {
    expect(validateProvider({ ...profile, name: ' Atelier Test ', email: ' CONTACT@example.test ' })).toEqual(profile)
  })

  it.each([null, [], { ...profile, siren: '123' }, { ...profile, email: 'invalid' }, { ...profile, name: ' ' }, { ...profile, address: 'x'.repeat(2001) }])('rejects invalid provider details: %j', (input) => {
    expect(() => validateProvider(input)).toThrow()
  })

  it('allows clearing or rotating a key and rejects invalid header characters', () => {
    expect(validateAbbyKey({ apiKey: '' })).toBe('')
    expect(validateAbbyKey({ apiKey: ' new-key ' })).toBe('new-key')
    for (const apiKey of ['key\r\ninjected', 'a b', 'é', 'a'.repeat(8193)]) {
      expect(() => validateAbbyKey({ apiKey })).toThrow()
    }
    expect(() => validateAbbyKey({})).toThrow()
  })

  it('supports email-only changes and preserves exact password characters', () => {
    expect(validateAccount({ email: ' OWNER@example.test ', currentPassword: ' current ', newPassword: '' }))
      .toEqual({ email: 'owner@example.test', currentPassword: ' current ', newPassword: '' })
  })

  it.each(['short', 'x'.repeat(1025), null])('rejects invalid new passwords', (newPassword) => {
    expect(() => validateAccount({ email: 'owner@example.test', currentPassword: 'current', newPassword })).toThrow()
  })
})
