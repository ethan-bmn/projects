import { getClientProjects } from '../../../services/projects'
import { fetchAbbyQuotes } from '../../../services/abby-quotes'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  return projectOperation(async () => {
    const { client } = await getClientProjects(getDatabase(event), projectRouteId(event, 'clientId'))
    return fetchAbbyQuotes(await getAbbyConfig(event), client)
  })
})
