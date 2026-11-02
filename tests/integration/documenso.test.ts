import { afterAll, describe, expect, it } from 'vitest'
import { getDocumensoSettings, saveDocumensoSettings } from '../../server/services/documenso'
import { decryptSetting } from '../../server/services/settings-secrets'
import { createTestDatabase } from '../helpers/database'
import { settingsSecret } from '../helpers/email'

const database = await createTestDatabase()
afterAll(database.cleanup)
const sql = database.sql

describe('Documenso settings', () => {
  it('encrypts the token, exposes only metadata, preserves blank inputs, and supports disconnecting', async () => {
    expect((await getDocumensoSettings(sql)).configured).toBe(false)
    const visible = await saveDocumensoSettings(sql, { apiToken: 'api_private' }, settingsSecret)
    expect(visible.configured).toBe(true)
    expect(JSON.stringify(visible)).not.toContain('api_private')
    const [row] = await sql`SELECT api_token FROM documenso_settings WHERE id = 1`
    expect(row!.api_token).not.toContain('api_private')
    expect(decryptSetting(row!.api_token, settingsSecret)).toBe('api_private')
    await saveDocumensoSettings(sql, { apiToken: '' }, settingsSecret)
    const [preserved] = await sql`SELECT api_token FROM documenso_settings WHERE id = 1`
    expect(preserved!.api_token).toBe(row!.api_token)
    expect((await saveDocumensoSettings(sql, { apiToken: '', disconnect: true }, settingsSecret)).configured).toBe(false)
  })

  it.each(['not-a-token', 'api_test\r\nX-Injected: yes'])('rejects invalid API keys', async (apiToken) => {
    await expect(saveDocumensoSettings(sql, { apiToken }, settingsSecret)).rejects.toThrow('clé API')
  })
})
