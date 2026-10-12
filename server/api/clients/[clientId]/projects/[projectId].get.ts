import { getProject } from '../../../../services/projects'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const clientId = projectRouteId(event, 'clientId')
  const projectId = projectRouteId(event, 'projectId')
  return projectOperation(() => getProject(getDatabase(event), clientId, projectId))
})
