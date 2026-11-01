import { getMailSettings } from '../../services/mail-settings'

export default defineEventHandler(event => settingsResponse(event, () => getMailSettings(getDatabase(event))))
