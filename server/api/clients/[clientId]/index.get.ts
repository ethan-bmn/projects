import { getClientProjects } from '../../../services/projects'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const clientId = projectRouteId(event, 'clientId')
  return projectOperation(() => getClientProjects(getDatabase(event), clientId))
})
