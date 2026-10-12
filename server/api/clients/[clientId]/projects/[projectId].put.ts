import { updateProject } from '../../../../services/projects'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const clientId = projectRouteId(event, 'clientId')
  const projectId = projectRouteId(event, 'projectId')
  const input = await readProjectInput(event)
  return projectOperation(() => updateProject(getDatabase(event), clientId, projectId, input))
})
