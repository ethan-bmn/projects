import type { ClientAddress } from '../types/clients'

export function formatClientAddress(value: ClientAddress | null) {
  if (!value) return ''
  return [value.address, value.complement, [value.zipCode, value.city].filter(Boolean).join(' '), value.state, value.country]
    .filter(Boolean).join('\n')
}
