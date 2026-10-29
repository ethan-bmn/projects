import { updateProspect } from '../../services/prospects'

export default defineEventHandler(async (event) => {
  const id = prospectRouteId(event)
  const input = await readProspectInput(event)
  return prospectOperation(() => updateProspect(getDatabase(event), id, input))
})
