import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const entrypoint = fileURLToPath(new URL('../../docker/documenso/entrypoint.mjs', import.meta.url))

function start(env: Record<string, string>) {
  return spawnSync(process.execPath, [entrypoint, process.execPath, '-e', `
    const assert = require('node:assert/strict')
    assert.equal(process.env.NEXT_PRIVATE_DATABASE_URL, process.env.EXPECTED_URL)
    assert.equal(process.env.NEXT_PRIVATE_DIRECT_DATABASE_URL, process.env.EXPECTED_DIRECT || process.env.EXPECTED_URL)
    console.log('configuration-ok')
  `], {
    encoding: 'utf8',
    env: { ...process.env, POSTGRES_PASSWORD: '', NEXT_PRIVATE_DATABASE_URL: '', NEXT_PRIVATE_DIRECT_DATABASE_URL: '',
      NEXTAUTH_SECRET: 'test-auth-secret-at-least-32-characters',
      NEXT_PRIVATE_ENCRYPTION_KEY: 'test-encryption-key-at-least-32-characters',
      NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: 'test-secondary-key-at-least-32-characters', ...env }
  })
}

describe('Documenso container configuration', () => {
  it('encodes raw database credentials and supplies the direct migration URL', () => {
    const result = start({
      POSTGRES_USER: 'sign@team', POSTGRES_PASSWORD: 'a@b:$c/d#e%f', POSTGRES_DB: 'sign/docs',
      EXPECTED_URL: 'postgresql://sign%40team:a%40b%3A%24c%2Fd%23e%25f@documenso-postgres:5432/sign%2Fdocs'
    })
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('configuration-ok')
  })

  it('preserves explicit connection and direct URLs', () => {
    const url = 'postgresql://test:fixture@external-db/documenso'
    const direct = 'postgresql://test:fixture@direct-db/documenso'
    const result = start({ NEXT_PRIVATE_DATABASE_URL: url, NEXT_PRIVATE_DIRECT_DATABASE_URL: direct, EXPECTED_URL: url, EXPECTED_DIRECT: direct })
    expect(result.status).toBe(0)
  })

  it('stops before starting Documenso when database credentials are missing', () => {
    const result = start({})
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('DOCUMENSO_POSTGRES_PASSWORD')
    expect(result.stdout).not.toContain('configuration-ok')
  })

  it.each(['NEXTAUTH_SECRET', 'NEXT_PRIVATE_ENCRYPTION_KEY', 'NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY'])('rejects a short %s before starting Documenso', (name) => {
    const result = start({ [name]: 'short', POSTGRES_PASSWORD: 'fixture' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('must contain at least 32 characters')
    expect(result.stdout).not.toContain('configuration-ok')
  })
})
