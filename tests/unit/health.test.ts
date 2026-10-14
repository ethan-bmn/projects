import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const query = vi.fn()
const setHeader = vi.fn()
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getDatabase', () => query)
vi.stubGlobal('setHeader', setHeader)
vi.stubGlobal('createError', (options: { statusCode: number, statusMessage: string }) => Object.assign(new Error(options.statusMessage), options))

const { default: health } = await import('../../server/routes/health.get')
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => vi.clearAllMocks())

describe('deployment health check', () => {
  it('reports readiness after a successful database query and disables caching', async () => {
    query.mockResolvedValueOnce([{ '?column?': 1 }])
    const event = {} as Parameters<typeof health>[0]
    await expect(health(event)).resolves.toEqual({ status: 'ok' })
    expect(query).toHaveBeenCalledOnce()
    expect(setHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'no-store')
  })

  it('returns an unavailable status without exposing database credentials or errors', async () => {
    query.mockRejectedValueOnce(new Error('Private database connection details'))
    await expect(health({} as Parameters<typeof health>[0])).rejects.toMatchObject({ statusCode: 503, message: 'Service unavailable' })
  })
})
