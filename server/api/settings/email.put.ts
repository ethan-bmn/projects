import { saveMailSettings } from '../../services/mail-settings'

export default defineEventHandler(event => settingsResponse(event, async () =>
  saveMailSettings(getDatabase(event), await readSettingsBody(event), process.env.NUXT_SESSION_PASSWORD || '')))
