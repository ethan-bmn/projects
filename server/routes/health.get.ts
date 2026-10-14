export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    await getDatabase(event)`SELECT 1`
    return { status: 'ok' }
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Service unavailable' })
  }
})
