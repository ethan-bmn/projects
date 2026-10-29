import { describe, expect, it } from 'vitest'
import { validateAbbyKey, validateAccount } from '../../server/services/settings'

describe('settings validation', () => {
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
