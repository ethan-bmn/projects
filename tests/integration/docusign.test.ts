import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { completeDocusignAuthorization, disconnectDocusign, getDocusignSettings, saveDocusignSettings, sendDocusignEnvelope, startDocusignAuthorization } from '../../server/services/docusign'
import { decryptSetting } from '../../server/services/settings-secrets'
import { createTestDatabase } from '../helpers/database'
import { settingsSecret } from '../helpers/email'

const database = await createTestDatabase()
afterAll(database.cleanup)
const sql = database.sql
const config = { environment: 'demo', integrationKey: 'integration-test', clientSecret: 'secret-test', redirectUri: 'https://projects.example.test/api/docusign/callback' }

beforeEach(async () => {
  await saveDocusignSettings(sql, config, settingsSecret)
})

function authorizationResponses() {
  return vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ access_token: 'access-test', refresh_token: 'refresh-test', expires_in: 3600 }))
    .mockResolvedValueOnce(Response.json({ accounts: [{ account_id: 'account-test', account_name: 'Atelier', is_default: true, base_uri: 'https://demo.docusign.net' }] }))
}

describe('DocuSign connection', () => {
  it('uses expiring single-use OAuth state, persists encrypted tokens and only exposes connection metadata', async () => {
    const authorization = await startDocusignAuthorization(sql)
    const url = new URL(authorization.url)
    expect(url.origin).toBe('https://account-d.docusign.com')
    expect(url.searchParams.get('state')).toBe(authorization.state)
    expect(url.searchParams.get('scope')).toBe('signature extended')
    const request = authorizationResponses()
    await completeDocusignAuthorization(sql, 'auth-code', authorization.state, settingsSecret, request)
    expect(String(request.mock.calls[0]![0])).toBe('https://account-d.docusign.com/oauth/token')
    expect(request.mock.calls[0]![1]).toMatchObject({ redirect: 'error', method: 'POST' })
    const [row] = await sql`SELECT access_token, refresh_token, oauth_state_hash FROM docusign_settings WHERE id = 1`
    expect(decryptSetting(row!.access_token, settingsSecret)).toBe('access-test')
    expect(row!.refresh_token).not.toContain('refresh-test')
    expect(row!.oauth_state_hash).toBeNull()
    const visible = await getDocusignSettings(sql)
    expect(visible).toMatchObject({ connected: true, accountName: 'Atelier' })
    expect(JSON.stringify(visible)).not.toContain('access-test')
    expect(JSON.stringify(visible)).not.toContain('secret-test')
    await expect(completeDocusignAuthorization(sql, 'auth-code', authorization.state, settingsSecret, request)).rejects.toThrow('expiré')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('rejects expired state and untrusted userinfo base URIs without persisting tokens', async () => {
    const authorization = await startDocusignAuthorization(sql)
    await sql`UPDATE docusign_settings SET oauth_expires_at = now() - interval '1 minute' WHERE id = 1`
    const request = authorizationResponses()
    await expect(completeDocusignAuthorization(sql, 'auth-code', authorization.state, settingsSecret, request)).rejects.toThrow('expiré')
    expect(request).not.toHaveBeenCalled()
    const fresh = await startDocusignAuthorization(sql)
    request.mockReset()
      .mockResolvedValueOnce(Response.json({ access_token: 'access-test', refresh_token: 'refresh-test', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ accounts: [{ account_id: 'account-test', base_uri: 'https://evil.example.test' }] }))
    await expect(completeDocusignAuthorization(sql, 'auth-code', fresh.state, settingsSecret, request)).rejects.toThrow('invalide')
    expect((await getDocusignSettings(sql)).connected).toBe(false)
  })

  it('refreshes an expired token before sending a remote signature invitation', async () => {
    const authorization = await startDocusignAuthorization(sql)
    await completeDocusignAuthorization(sql, 'auth-code', authorization.state, settingsSecret, authorizationResponses())
    await sql`UPDATE docusign_settings SET expires_at = now() - interval '1 minute' WHERE id = 1`
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ envelopeId: 'envelope-test', status: 'sent' }))
    const input = { id: 'transaction-test', to: 'client@example.test', name: 'Client', subject: 'Votre devis', text: 'Bonjour', filename: 'devis.pdf', pdf: Buffer.from('%PDF-1.7\nfixture') }
    expect(await sendDocusignEnvelope(sql, settingsSecret, input, request)).toBe('envelope-test')
    expect(String(request.mock.calls[1]![0])).toBe('https://demo.docusign.net/restapi/v2.1/accounts/account-test/envelopes')
    expect(request.mock.calls[1]![1]).toMatchObject({ method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer new-access' } })
    const payload = JSON.parse(String(request.mock.calls[1]![1]!.body))
    expect(payload).toMatchObject({ transactionId: input.id, status: 'sent' })
    const [row] = await sql`SELECT refresh_token FROM docusign_settings WHERE id = 1`
    expect(decryptSetting(row!.refresh_token, settingsSecret)).toBe('new-refresh')
    expect((await disconnectDocusign(sql)).connected).toBe(false)
  })
})
