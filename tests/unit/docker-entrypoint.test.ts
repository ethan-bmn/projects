import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/sh'
const entrypoint = fileURLToPath(new URL('../../docker/entrypoint.sh', import.meta.url)).replace(/\\/g, '/')

describe.skipIf(!existsSync(shell))('Docker app initialization', () => {
  function start(seedExit: number, sessionPassword = 'test-session-secret-at-least-32-characters') {
    return spawnSync(shell, ['-c', `
bun() {
  printf 'seed:%s\\n' "$*"
  return "$SEED_EXIT"
}
set -- sh -c 'printf "server-started\\n"'
. "$ENTRYPOINT_PATH"
`], {
      env: { ...process.env, SEED_EXIT: String(seedExit), ENTRYPOINT_PATH: entrypoint, NUXT_SESSION_PASSWORD: sessionPassword },
      encoding: 'utf8'
    })
  }

  it('runs the migration/seed command before starting the server on every start', () => {
    for (let restart = 0; restart < 2; restart++) {
      const result = start(0)
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('seed:scripts/seed-owner.ts')
      expect(result.stdout.indexOf('seed:scripts/seed-owner.ts')).toBeLessThan(result.stdout.indexOf('server-started'))
      expect(result.stdout).toContain('server-started')
    }
  })

  it('does not start the server when migrations or seeding fail', () => {
    const result = start(7)
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(7)
    expect(result.stdout).toContain('seed:scripts/seed-owner.ts')
    expect(result.stdout).not.toContain('server-started')
  })

  it.each(['', 'short'])('reports an invalid session secret before initializing the database', (secret) => {
    const result = start(0, secret)
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('NUXT_SESSION_PASSWORD must contain at least 32 characters')
    expect(result.stdout).not.toContain('seed:')
    expect(result.stdout).not.toContain('server-started')
  })
})
