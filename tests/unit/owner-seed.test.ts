import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { describe, expect, it } from 'vitest'
import { ownerSeedCredentials } from '../../database/setup'

describe('owner seed password validation', () => {
  it('hashes a short password without changing it', async () => {
    const credentials = await ownerSeedCredentials({ NUXT_OWNER_EMAIL: 'owner@example.test', NUXT_OWNER_PASSWORD: 'x' })
    expect(await new Scrypt({}).verify(credentials.hash, 'x')).toBe(true)
  })

  it.each(['', 'x'.repeat(1025)])('rejects an empty or oversized password', async (password) => {
    await expect(ownerSeedCredentials({ NUXT_OWNER_EMAIL: 'owner@example.test', NUXT_OWNER_PASSWORD: password })).rejects.toThrow('NUXT_OWNER_PASSWORD')
  })
})
