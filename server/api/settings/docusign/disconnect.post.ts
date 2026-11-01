import { disconnectDocusign } from '../../../services/docusign'

export default defineEventHandler(event => settingsResponse(event, () => disconnectDocusign(getDatabase(event))))
