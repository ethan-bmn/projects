import type { H3Event } from 'h3'
import type { AbbyConfig } from '../services/abby-client'

export function getAbbyConfig(event?: H3Event): AbbyConfig {
  const config = useRuntimeConfig(event)
  return { apiKey: config.abbyApiKey, baseUrl: config.abbyApiBaseUrl }
}
