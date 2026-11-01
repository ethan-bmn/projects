import { getDocusignSettings } from '../../services/docusign'

export default defineEventHandler(event => settingsResponse(event, () => getDocusignSettings(getDatabase(event))))
