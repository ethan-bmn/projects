import type { H3Event } from 'h3'
import type { AbbyConfig } from '../services/abby-client'

export async function getAbbyConfig(event?: H3Event): Promise<AbbyConfig> {
  const config = useRuntimeConfig(event)
  const [settings] = await getDatabase(event)<{ api_key: string }[]>`
    SELECT api_key FROM abby_settings WHERE id = 1
  `
  return { apiKey: settings?.api_key.trim() ?? '', baseUrl: config.abbyApiBaseUrl }
}
