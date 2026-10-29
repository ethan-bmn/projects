import { listProspects } from '../../services/prospects'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const query = getQuery(event)
  const page = Number(query.page ?? 1)
  const search = query.search ?? ''
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) {
    throw createError({ statusCode: 400, message: 'Le numéro de page est invalide.' })
  }
  if (typeof search !== 'string' || search.length > 200) {
    throw createError({ statusCode: 400, message: 'La recherche est invalide.' })
  }
  return prospectOperation(() => listProspects(getDatabase(event), page, search.trim()))
})
