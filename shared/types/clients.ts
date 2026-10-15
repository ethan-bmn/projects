export type ClientKind = 'organization' | 'individual'

export type ClientAddress = {
  address: string | null
  complement: string | null
  city: string | null
  zipCode: string | null
  state: string | null
  country: string | null
}

export interface Client {
  id: string
  abbyId: string
  kind: ClientKind
  name: string
  emails: string[]
  commercialName: string | null
  billingAddress: ClientAddress | null
}

export interface ClientList {
  clients: Client[]
  total: number
  page: number
  pageSize: number
  sync: {
    configured: boolean
    lastSuccessAt: string | null
    lastAttemptAt: string | null
    lastError: string | null
  }
}
