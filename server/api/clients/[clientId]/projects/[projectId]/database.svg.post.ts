import { getProject } from '../../../../../services/projects'
import { projectSvgFilename } from '../../../../../../shared/utils/project-filenames'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const clientId = projectRouteId(event, 'clientId')
  const projectId = projectRouteId(event, 'projectId')
  const detail = await projectOperation(() => getProject(getDatabase(event), clientId, projectId))
  const source = detail.project.diagrams?.database
  if (!source) throw createError({ statusCode: 400, message: 'Ce projet ne contient pas de diagramme ChartDB.' })
  let response: Response
  try {
    response = await fetch(`${useRuntimeConfig(event).chartdbExportUrl.replace(/\/$/, '')}/export`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }), signal: AbortSignal.timeout(80000)
    })
  } catch {
    throw createError({ statusCode: 503, message: 'Le service d’export ChartDB est indisponible. Démarrez les services Docker du profil diagrams.' })
  }
  if (!response.ok) {
    throw createError({ statusCode: response.status === 429 ? 429 : 503, message: response.status === 429 ? 'Un export ChartDB est déjà en cours. Réessayez dans un instant.' : 'Impossible de générer le SVG avec ChartDB. Réessayez.' })
  }
  const svg = await response.text()
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg)) throw createError({ statusCode: 503, message: 'ChartDB n’a pas renvoyé une image SVG valide.' })
  setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${projectSvgFilename(detail.project.name)}"`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Content-Security-Policy', 'sandbox; default-src \'none\'; style-src \'unsafe-inline\'; img-src data:')
  return svg
})
