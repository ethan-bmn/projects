export function formatDatabaseError(error: unknown, env: Record<string, string | undefined> = process.env) {
  const lines: string[] = []
  const seen = new Set<unknown>()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    if (typeof current !== 'object') {
      lines.push(String(current))
      break
    }
    const details = current as Record<string, unknown>
    lines.push(`${lines.length ? 'Cause: ' : ''}${details.message || 'Unknown database error'}`)
    for (const [field, label] of Object.entries({
      code: 'Code',
      severity: 'Severity',
      detail: 'Detail',
      hint: 'Hint',
      schema_name: 'Schema',
      table_name: 'Table',
      constraint_name: 'Constraint',
      position: 'SQL position'
    })) {
      if (details[field] !== undefined) lines.push(`  ${label}: ${details[field]}`)
    }
    current = details.cause
  }

  // Print diagnostic fields, never the complete driver error with SQL parameters.
  let message = lines.join('\n') || 'Unknown database error'
  message = message.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[redacted database URL]')
  for (const name of ['DATABASE_URL', 'NUXT_DATABASE_URL', 'POSTGRES_PASSWORD', 'NUXT_OWNER_PASSWORD', 'NUXT_OWNER_PASSWORD_HASH', 'NUXT_SESSION_PASSWORD']) {
    const secret = env[name]
    if (secret) message = message.split(secret).join('[redacted]')
  }
  return message
}
