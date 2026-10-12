import { randomBytes } from 'node:crypto'
import postgres from 'postgres'
import { migrateDatabase } from '../../database/setup'

export async function createTestDatabase() {
  const connection = process.env.TEST_DATABASE_URL || process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL
  if (!connection) throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to PostgreSQL before running integration tests')
  const admin = postgres(connection, { max: 1, connect_timeout: 10, onnotice: () => {} })
  const name = `abby_auth_test_${randomBytes(8).toString('hex')}`
  const url = new URL(connection)
  url.pathname = `/${name}`
  // Migration fixtures switch schemas and change result shapes within a session.
  const sql = postgres(url.toString(), { max: 1, prepare: false, onnotice: () => {} })

  async function cleanup() {
    await sql.end()
    // Only the randomly named database created by this test may be removed.
    if (!/^abby_auth_test_[a-f0-9]{16}$/.test(name)) throw new Error('Invalid test database name')
    await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH (FORCE)`
    await admin.end()
  }

  try {
    await admin`CREATE DATABASE ${admin(name)}`
    await migrateDatabase(sql)
  } catch (error) {
    await cleanup()
    throw error
  }
  return { sql, url: url.toString(), cleanup }
}
