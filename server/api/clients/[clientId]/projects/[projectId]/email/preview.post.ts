import { previewQuoteEmail } from '../../../../../../services/quote-email'

export default defineEventHandler(event => quoteEmailOperation(event, async () =>
  previewQuoteEmail(getDatabase(event), projectRouteId(event, 'clientId'), projectRouteId(event, 'projectId'), await getAbbyConfig(event), await readSettingsBody(event))))
