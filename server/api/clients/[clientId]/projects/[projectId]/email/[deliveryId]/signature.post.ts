import { requestDeliverySignature } from '../../../../../../../services/quote-email'
import { SettingsError } from '../../../../../../../services/settings'

export default defineEventHandler(event => quoteEmailOperation(event, async () => {
  const id = getRouterParam(event, 'deliveryId')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new SettingsError('Identifiant d’envoi invalide.')
  return requestDeliverySignature(getDatabase(event), projectRouteId(event, 'clientId'), projectRouteId(event, 'projectId'), id, process.env.NUXT_SESSION_PASSWORD || '')
}))
