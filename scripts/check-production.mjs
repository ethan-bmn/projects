import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

// Run only the deployable output, without falling back to workspace dependencies.
const directory = await mkdtemp(join(tmpdir(), 'abby-server-check-'))
try {
  await cp(new URL('../.output/', import.meta.url), join(directory, 'output'), { recursive: true })
  const reservation = createServer()
  await new Promise((resolve, reject) => {
    reservation.once('error', reject)
    reservation.listen(0, '127.0.0.1', resolve)
  })
  const { port } = reservation.address()
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()))

  const child = spawn(process.execPath, [join(directory, 'output/server/index.mjs')], {
    cwd: directory,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(port),
      PORT: String(port),
      NITRO_UNIX_SOCKET: '',
      NITRO_SSL_CERT: '',
      NITRO_SSL_KEY: '',
      DATABASE_URL: '',
      NUXT_DATABASE_URL: '',
      NUXT_SESSION_PASSWORD: 'production-startup-check-session-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  let stopped = false
  const completion = new Promise(resolve => child.once('exit', () => {
    stopped = true
    resolve()
  }))
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Production server did not start.\n${output}`)), 15000)
      const finish = (error) => {
        clearTimeout(timeout)
        if (error) reject(error)
        else resolve()
      }
      child.once('error', finish)
      child.once('exit', code => finish(new Error(`Production server exited (${code}).\n${output}`)))
      child.stderr.on('data', (data) => {
        output = (output + data).slice(-32000)
      })
      child.stdout.on('data', (data) => {
        output = (output + data).slice(-32000)
        if (output.includes('Listening on ')) finish()
      })
    })
    for (const path of ['/api/_auth/session', '/auth']) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(10000), redirect: 'error' })
      assert.equal(response.status, 200, `Production route ${path} failed: ${await response.text()}`)
    }
    console.log('Isolated production server started; session and login routes returned HTTP 200.')
  } finally {
    if (!stopped && child.pid) {
      child.kill('SIGTERM')
      const timeout = setTimeout(() => child.kill('SIGKILL'), 5000)
      await completion
      clearTimeout(timeout)
    }
  }
} finally {
  // Delete only the temporary directory allocated by this check.
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
  assert.ok(basename(directory).startsWith('abby-server-check-'))
  await rm(directory, { recursive: true, force: true })
}
