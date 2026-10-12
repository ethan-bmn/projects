import { createProject } from '../../../../services/projects'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const clientId = projectRouteId(event, 'clientId')
  const input = await readProjectInput(event)
  const project = await projectOperation(() => createProject(getDatabase(event), clientId, input))
  setResponseStatus(event, 201)
  return project
})
