import { describe, expect, it } from 'vitest'
import { formatDatabaseError } from '../../database/errors'

describe('database error diagnostics', () => {
  it('reports the failed migration and PostgreSQL diagnostics from its cause', () => {
    const cause = Object.assign(new Error('relation "user" already exists'), {
      code: '42P07',
      severity: 'ERROR',
      hint: 'Check the migration history.',
      table_name: 'user',
      position: '14'
    })
    const output = formatDatabaseError(new Error('Migration failed: 002_rename_owner_accounts_to_user.sql', { cause }), {})
    expect(output).toContain('002_rename_owner_accounts_to_user.sql')
    expect(output).toContain('relation "user" already exists')
    expect(output).toContain('Code: 42P07')
    expect(output).toContain('Hint: Check the migration history.')
    expect(output).toContain('Table: user')
    expect(output).toContain('SQL position: 14')
  })

  it('redacts credentials and excludes query parameters from diagnostics', () => {
    const error = Object.assign(new Error('Cannot connect to postgresql://owner:private-password@localhost/db'), {
      detail: 'Rejected secret-login-password',
      query: 'INSERT INTO "user" VALUES ($1)',
      parameters: ['private-hash']
    })
    const output = formatDatabaseError(error, { NUXT_OWNER_PASSWORD: 'secret-login-password' })
    expect(output).toContain('[redacted database URL]')
    expect(output).toContain('[redacted]')
    expect(output).not.toContain('private-password')
    expect(output).not.toContain('secret-login-password')
    expect(output).not.toContain('private-hash')
    expect(output).not.toContain('INSERT')
  })

  it('handles missing errors and circular causes', () => {
    expect(formatDatabaseError(undefined, {})).toBe('Unknown database error')
    const error = new Error('Connection refused')
    error.cause = error
    expect(formatDatabaseError(error, {})).toBe('Connection refused')
  })
})
