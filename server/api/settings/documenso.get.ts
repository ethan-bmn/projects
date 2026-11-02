import { getDocumensoSettings } from '../../services/documenso'

export default defineEventHandler(event => settingsResponse(event, () => getDocumensoSettings(getDatabase(event))))
