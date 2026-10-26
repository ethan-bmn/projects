import { deleteProspect } from '../../services/prospects'

export default defineEventHandler(async (event) => {
  const id = prospectRouteId(event)
  await prospectOperation(() => deleteProspect(getDatabase(event), id))
  setResponseStatus(event, 204)
  return null
})
