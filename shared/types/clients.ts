export type ClientKind = 'organization' | 'individual'

export interface Client {
  id: string
  abbyId: string
  kind: ClientKind
  name: string
  emails: string[]
  commercialName: string | null
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
