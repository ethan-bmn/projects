export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch: refreshSession } = useUserSession()
  await refreshSession()

  const isAuthPage = to.path.replace(/\/+$/, '') === '/auth'

  if (!loggedIn.value && !isAuthPage) {
    return navigateTo('/auth', { replace: true })
  }

  if (loggedIn.value && isAuthPage) {
    return navigateTo('/', { replace: true })
  }
})
