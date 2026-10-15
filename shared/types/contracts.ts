export type ContractConfiguration = {
  choices: Record<string, string>
  selections: Record<string, string[]>
  confirmations: Record<string, boolean>
}

export type ProjectContract = {
  version: 1 | 2
  fields: Record<string, string>
  includeDataProcessing: boolean
  quote: { name: string, data: string } | null
  configuration?: ContractConfiguration
}
