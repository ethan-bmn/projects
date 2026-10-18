import { saveAccount, SettingsError } from '../../services/settings'

const attempts = new Map<string, { count: number, expiresAt: number }>()

export default defineEventHandler(event => settingsResponse(event, async () => {
  const now = Date.now()
  for (const [key, value] of attempts) {
    if (value.expiresAt <= now) attempts.delete(key)
  }
  const address = getRequestIP(event) || 'unknown'
  const attempt = attempts.get(address) ?? { count: 0, expiresAt: now + 60_000 }
  if (attempt.count >= 5 || (attempts.size >= 1000 && !attempts.has(address))) {
    setHeader(event, 'Retry-After', 60)
    throw new SettingsError('Trop de tentatives. Réessayez dans une minute.', 429)
  }
  attempt.count++
  attempts.set(address, attempt)
  const owner = await getOwnerAccount(event)
  if (!owner) throw new SettingsError('Le compte utilisateur est indisponible.', 503)
  const account = await saveAccount(getDatabase(event), await readSettingsBody(event), owner)
  await replaceUserSession(event, {
    user: { id: 'owner', email: account.email },
    secure: { passwordVersion: ownerPasswordVersion(account.password_hash) }
  })
  attempts.delete(address)
  return { email: account.email }
}))
