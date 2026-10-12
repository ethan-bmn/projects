import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import type { UserSession } from '#auth-utils'

export function ownerPasswordVersion(hash: string) {
  return createHash('sha256').update(hash).digest('hex')
}

export async function isOwnerSession(event: H3Event, session: UserSession) {
  if (session.user?.id !== 'owner') return false
  const owner = await getOwnerAccount(event)
  if (!owner) return false
  return session.user.email === owner.email
    && session.secure?.passwordVersion === ownerPasswordVersion(owner.password_hash)
}

export async function requireOwnerSession(event: H3Event) {
  const session = await getUserSession(event)
  if (!await isOwnerSession(event, session)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Veuillez vous connecter pour continuer.' })
  }
  return session
}
