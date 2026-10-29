import { createProspect } from '../../services/prospects'

export default defineEventHandler(async (event) => {
  const input = await readProspectInput(event)
  const result = await prospectOperation(() => createProspect(getDatabase(event), input))
  setResponseStatus(event, 201)
  return result
})
