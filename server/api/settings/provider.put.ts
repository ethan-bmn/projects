import { saveProvider } from '../../services/settings'

export default defineEventHandler(event => settingsResponse(event, async () => saveProvider(getDatabase(event), await readSettingsBody(event))))
