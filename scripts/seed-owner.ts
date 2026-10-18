import { connectDatabase, migrateDatabase, ownerSeedCredentials, seedOwner } from '../database/setup'
import { formatDatabaseError } from '../database/errors'

const sql = connectDatabase()
try {
  await migrateDatabase(sql)
  const [owner] = await sql`SELECT id FROM "user" WHERE id = 1`
  if (!owner || process.argv.includes('--update')) {
    const credentials = await ownerSeedCredentials(process.env)
    await seedOwner(sql, credentials)
    console.log('Single owner account seeded from .env.')
  } else {
    console.log('Existing owner account preserved. Use --update to reset credentials from .env.')
  }
} catch (error) {
  console.error(`Owner seed failed.\n${formatDatabaseError(error)}`)
  process.exitCode = 1
} finally {
  await sql.end()
}
