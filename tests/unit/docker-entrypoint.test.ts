import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/sh'
const entrypoint = fileURLToPath(new URL('../../docker/entrypoint.sh', import.meta.url)).replace(/\\/g, '/')

describe.skipIf(!existsSync(shell))('Docker app initialization', () => {
  function start(seedExit: number) {
    return spawnSync(shell, ['-c', `
bun() {
  printf 'seed:%s\\n' "$*"
  return "$SEED_EXIT"
}
set -- sh -c 'printf "server-started\\n"'
. "$ENTRYPOINT_PATH"
`], {
      env: { ...process.env, SEED_EXIT: String(seedExit), ENTRYPOINT_PATH: entrypoint },
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
})
