export type ProjectContract = {
  version: 1
  fields: Record<string, string>
  includeDataProcessing: boolean
  quote: { name: string, data: string } | null
}
