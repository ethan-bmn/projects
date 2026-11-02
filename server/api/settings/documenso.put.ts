import { saveDocumensoSettings } from '../../services/documenso'

export default defineEventHandler(event => settingsResponse(event, async () =>
  saveDocumensoSettings(getDatabase(event), await readSettingsBody(event), process.env.NUXT_SESSION_PASSWORD || '')))
