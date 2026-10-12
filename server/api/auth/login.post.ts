// This in-memory limit is appropriate for one server instance.
// A shared limiter is required if the application is deployed on multiple instances.
const attempts = new Map<string, { count: number, expiresAt: number }>()

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const now = Date.now()
  for (const [key, value] of attempts) {
    if (value.expiresAt <= now) attempts.delete(key)
  }
  const address = getRequestIP(event) || 'unknown'
  const attempt = attempts.get(address) || { count: 0, expiresAt: now + 60_000 }
  if (attempt.count >= 10 || (attempts.size >= 1000 && !attempts.has(address))) {
    setHeader(event, 'Retry-After', 60)
    throw createError({ statusCode: 429, statusMessage: 'Too many login attempts', message: 'Trop de tentatives de connexion. Réessayez dans une minute.' })
  }
  attempt.count++
  attempts.set(address, attempt)

  if (getHeader(event, 'content-type')?.split(';')[0]?.trim() !== 'application/json') {
    throw createError({ statusCode: 415, statusMessage: 'Expected JSON', message: 'La requête doit être au format JSON.' })
  }
  const body = await readBody(event)
  if (typeof body?.email !== 'string' || typeof body?.password !== 'string'
    || body.email.length > 254 || !body.password.length || body.password.length > 1024) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid login request', message: 'La demande de connexion est invalide.' })
  }

  // Verify the password even for an unknown email to avoid a fast identity check.
  const owner = await getOwnerAccount(event)
  if (!owner) {
    throw createError({ statusCode: 503, statusMessage: 'Owner account has not been seeded', message: 'Le compte utilisateur n’a pas encore été initialisé.' })
  }
  const passwordValid = await verifyPassword(owner.password_hash, body.password)
  const email = owner.email
  if (!passwordValid || body.email.trim().toLowerCase() !== email) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials', message: 'Adresse e-mail ou mot de passe incorrect.' })
  }

  await replaceUserSession(event, {
    user: { id: 'owner', email },
    secure: { passwordVersion: ownerPasswordVersion(owner.password_hash) }
  })
  attempts.delete(address)
  return { success: true }
})
