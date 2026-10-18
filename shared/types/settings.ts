import type { ProviderProfile } from './provider'

export interface GlobalSettings {
  email: string
  abbyConfigured: boolean
  provider: ProviderProfile
}
