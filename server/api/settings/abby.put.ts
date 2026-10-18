import { saveAbbyKey } from '../../services/settings'

export default defineEventHandler(event => settingsResponse(event, async () => saveAbbyKey(getDatabase(event), await readSettingsBody(event))))
