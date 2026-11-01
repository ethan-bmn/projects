import { mailTransport } from '../../../services/mail-settings'
import { SettingsError } from '../../../services/settings'

export default defineEventHandler(event => settingsResponse(event, async () => {
  const { transport } = await mailTransport(getDatabase(event), process.env.NUXT_SESSION_PASSWORD || '')
  try {
    await transport.verify()
    return { verified: true }
  } catch {
    throw new SettingsError('Connexion SMTP refusée. Vérifiez le serveur, le port et les identifiants.', 502)
  } finally {
    transport.close()
  }
}))
