export interface ProspectInput {
  name: string
  email: string
  phone: string
  domain: string
  websiteUrl: string | null
}

export interface Prospect extends ProspectInput {
  id: string
  createdAt: string
  updatedAt: string
}

export interface ProspectList {
  prospects: Prospect[]
  total: number
  page: number
  pageSize: number
}
