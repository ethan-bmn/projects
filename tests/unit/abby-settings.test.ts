import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAbbyConfig } from '../../server/utils/abby'

const query = vi.fn()
vi.stubGlobal('getDatabase', () => query)
vi.stubGlobal('useRuntimeConfig', () => ({
  abbyApiBaseUrl: 'https://api.app-abby.com',
  abbyApiKey: 'unused-environment-key'
}))

afterAll(() => vi.unstubAllGlobals())
beforeEach(() => vi.clearAllMocks())

describe('database Abby configuration', () => {
  it('uses the stored key and reloads it after rotation', async () => {
    query.mockResolvedValueOnce([{ api_key: ' stored-key ' }])
      .mockResolvedValueOnce([{ api_key: 'rotated-key' }])
    await expect(getAbbyConfig()).resolves.toEqual({ apiKey: 'stored-key', baseUrl: 'https://api.app-abby.com' })
    await expect(getAbbyConfig()).resolves.toEqual({ apiKey: 'rotated-key', baseUrl: 'https://api.app-abby.com' })
  })

  it('treats an empty or missing setting as unconfigured without an environment fallback', async () => {
    query.mockResolvedValueOnce([{ api_key: ' \t\n' }]).mockResolvedValueOnce([])
    expect((await getAbbyConfig()).apiKey).toBe('')
    expect((await getAbbyConfig()).apiKey).toBe('')
  })

  it('rejects when the database is unavailable instead of using the environment key', async () => {
    query.mockRejectedValueOnce(new Error('Database unavailable'))
    await expect(getAbbyConfig()).rejects.toThrow('Database unavailable')
  })
})
