import { spawn } from 'node:child_process'

for (const [name, setting] of Object.entries({
  NEXTAUTH_SECRET: 'DOCUMENSO_AUTH_SECRET',
  NEXT_PRIVATE_ENCRYPTION_KEY: 'DOCUMENSO_ENCRYPTION_KEY',
  NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: 'DOCUMENSO_ENCRYPTION_SECONDARY_KEY'
})) {
  if ((process.env[name] || '').length < 32) {
    console.error(`${setting} must contain at least 32 characters.`)
    process.exit(1)
  }
}

if (!process.env.NEXT_PRIVATE_DATABASE_URL) {
  if (!process.env.POSTGRES_PASSWORD) {
    console.error('Set DOCUMENSO_POSTGRES_PASSWORD before starting Documenso.')
    process.exit(1)
  }
  const user = encodeURIComponent(process.env.POSTGRES_USER || 'documenso')
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD)
  const database = encodeURIComponent(process.env.POSTGRES_DB || 'documenso')
  process.env.NEXT_PRIVATE_DATABASE_URL = `postgresql://${user}:${password}@documenso-postgres:5432/${database}`
}
process.env.NEXT_PRIVATE_DIRECT_DATABASE_URL ||= process.env.NEXT_PRIVATE_DATABASE_URL

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('Provide a Documenso container command.')
  process.exit(1)
}
const child = spawn(command, args, { stdio: 'inherit', env: process.env })
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => child.kill(signal))
}
child.on('error', () => {
  console.error('Unable to start Documenso.')
  process.exit(1)
})
child.on('exit', (code, signal) => process.exit(code ?? (signal === 'SIGINT' ? 130 : 143)))
