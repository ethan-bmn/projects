import { spawn } from 'node:child_process'

// Build the container URL from raw credentials, including passwords with @, $ or /.
if (!process.env.NUXT_DATABASE_URL && !process.env.DATABASE_URL) {
  if (!process.env.POSTGRES_PASSWORD) {
    console.error('Set POSTGRES_PASSWORD before starting the container.')
    process.exit(1)
  }
  const user = encodeURIComponent(process.env.POSTGRES_USER || 'abby_projects')
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD)
  const database = encodeURIComponent(process.env.POSTGRES_DB || 'abby_projects')
  process.env.DATABASE_URL = `postgresql://${user}:${password}@postgres:5432/${database}`
}
process.env.NUXT_DATABASE_URL ||= process.env.DATABASE_URL

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('Provide a container command.')
  process.exit(1)
}
const child = spawn(command, args, { stdio: 'inherit', env: process.env })
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => child.kill(signal))
}
child.on('error', () => {
  console.error('Unable to start the container command.')
  process.exit(1)
})
child.on('exit', (code, signal) => process.exit(code ?? (signal === 'SIGINT' ? 130 : 143)))
