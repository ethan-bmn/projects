import { syncClients } from '../services/client-sync'

export default defineNitroPlugin((nitroApp) => {
  let running: Promise<void> | undefined

  function check() {
    if (running) return
    running = (async () => {
      try {
        const config = await getAbbyConfig()
        if (!config.apiKey) return
        const result = await syncClients(getDatabase(), config, { automatic: true })
        if (result.status === 'failed') console.error(`[Abby] ${result.message}`)
      } catch {
        // Database errors may contain credentials or client details.
        console.error('[Abby] Synchronisation indisponible. Vérifiez la base de données et les migrations.')
      } finally {
        running = undefined
      }
    })()
  }

  // Catch up after downtime; the DB timestamps prevent extra daily imports.
  const startup = setTimeout(check, 5000)
  const interval = setInterval(check, 60 * 60_000)
  startup.unref()
  interval.unref()
  nitroApp.hooks.hook('close', async () => {
    clearTimeout(startup)
    clearInterval(interval)
    await running
  })
})
