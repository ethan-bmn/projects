import { getProject } from '../../../../../services/projects'
import { fetchAbbyQuote } from '../../../../../services/abby-quotes'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  return projectOperation(async () => {
    const { client, project } = await getProject(getDatabase(event), projectRouteId(event, 'clientId'), projectRouteId(event, 'projectId'))
    return project.quoteId ? fetchAbbyQuote(await getAbbyConfig(event), client, project.quoteId) : null
  })
})
