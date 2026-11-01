import { sendQuoteEmail } from '../../../../../../services/quote-email'

export default defineEventHandler(event => quoteEmailOperation(event, async () =>
  sendQuoteEmail(getDatabase(event), projectRouteId(event, 'clientId'), projectRouteId(event, 'projectId'), await getAbbyConfig(event), await readSettingsBody(event), process.env.NUXT_SESSION_PASSWORD || '')))
