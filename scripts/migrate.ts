import { connectDatabase, migrateDatabase } from '../database/setup'
import { formatDatabaseError } from '../database/errors'

let sql: ReturnType<typeof connectDatabase> | undefined
try {
  sql = connectDatabase()
  await migrateDatabase(sql)
  console.log('Database migrations applied.')
} catch (error) {
  console.error(`Database migration failed.\n${formatDatabaseError(error)}`)
  process.exitCode = 1
} finally {
  await sql?.end()
}
