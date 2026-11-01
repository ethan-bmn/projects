import { getQuoteDeliveries } from '../../../../../../services/quote-email'

export default defineEventHandler(event => quoteEmailOperation(event, () =>
  getQuoteDeliveries(getDatabase(event), projectRouteId(event, 'clientId'), projectRouteId(event, 'projectId'))))
