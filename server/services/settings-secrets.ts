import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { SettingsError } from './settings'

function key(secret: string) {
  if (secret.length < 32) throw new SettingsError('Configurez NUXT_SESSION_PASSWORD avec au moins 32 caractères.', 503)
  return createHash('sha256').update(`abby-projects:settings:${secret}`).digest()
}

export function encryptSetting(value: string, secret: string) {
  if (!value) return ''
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.')
}

export function decryptSetting(value: string, secret: string) {
  if (!value) return ''
  try {
    const parts = value.split('.')
    if (parts.length !== 3) throw new Error('Invalid encrypted setting')
    const [iv, tag, data] = parts.map(part => Buffer.from(part, 'base64url')) as [Buffer, Buffer, Buffer]
    const cipher = createDecipheriv('aes-256-gcm', key(secret), iv)
    cipher.setAuthTag(tag)
    return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8')
  } catch {
    throw new SettingsError('Impossible de déchiffrer les identifiants. Enregistrez-les à nouveau après un changement du secret de session.', 503)
  }
}
