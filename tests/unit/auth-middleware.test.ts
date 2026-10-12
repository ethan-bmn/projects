import { beforeEach, describe, expect, it, vi } from 'vitest'

const loggedIn = { value: false }
const refreshSession = vi.fn()
const navigateTo = vi.fn((path: string) => path)

vi.stubGlobal('defineNuxtRouteMiddleware', (handler: unknown) => handler)
vi.stubGlobal('useUserSession', () => ({ loggedIn, fetch: refreshSession }))
vi.stubGlobal('navigateTo', navigateTo)

const { default: middleware } = await import('../../app/middleware/auth.global')

async function visit(path: string) {
  return middleware({ path } as Parameters<typeof middleware>[0], {} as Parameters<typeof middleware>[1])
}

describe('global authentication middleware', () => {
  beforeEach(() => {
    loggedIn.value = false
    vi.clearAllMocks()
    refreshSession.mockResolvedValue(undefined)
  })

  it.each(['/', '/clients', '/projects/42', '/auth/reset'])('protects %s for visitors', async (path) => {
    await visit(path)
    expect(refreshSession).toHaveBeenCalledOnce()
    expect(navigateTo).toHaveBeenCalledWith('/auth', { replace: true })
  })

  it.each(['/auth', '/auth/'])('allows visitors to open %s', async (path) => {
    await visit(path)
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('redirects the signed-in owner from auth to index', async () => {
    loggedIn.value = true
    await visit('/auth')
    expect(navigateTo).toHaveBeenCalledWith('/', { replace: true })
  })

  it.each(['/', '/clients', '/projects/42'])('allows the signed-in owner to open %s', async (path) => {
    loggedIn.value = true
    await visit(path)
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('revalidates an expired session before allowing navigation', async () => {
    loggedIn.value = true
    refreshSession.mockImplementationOnce(async () => {
      loggedIn.value = false
    })
    await visit('/projects/42')
    expect(navigateTo).toHaveBeenCalledWith('/auth', { replace: true })
  })
})
