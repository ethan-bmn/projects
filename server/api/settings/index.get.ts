import { getGlobalSettings } from '../../services/settings'

export default defineEventHandler(event => settingsResponse(event, () => getGlobalSettings(getDatabase(event))))
