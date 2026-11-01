import { saveDocusignSettings } from '../../services/docusign'

export default defineEventHandler(event => settingsResponse(event, async () =>
  saveDocusignSettings(getDatabase(event), await readSettingsBody(event), process.env.NUXT_SESSION_PASSWORD || '')))
