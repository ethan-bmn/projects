import { connectDatabase, migrateDatabase, ownerSeedCredentials, seedOwner } from '../database/setup'
import { formatDatabaseError } from '../database/errors'

// Validate configuration before opening a connection or modifying the database.
const credentials = await ownerSeedCredentials(process.env).catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
const sql = connectDatabase()
try {
  await migrateDatabase(sql)
  await seedOwner(sql, credentials)
  console.log('Single owner account seeded from .env.')
} catch (error) {
  console.error(`Owner seed failed.\n${formatDatabaseError(error)}`)
  process.exitCode = 1
} finally {
  await sql.end()
}
