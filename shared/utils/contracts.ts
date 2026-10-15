import template from '../contract-template.json'
import type { Client } from '../types/clients'
import type { ProjectContract } from '../types/contracts'

export const contractSections = template.map((section, index) => ({
  ...section,
  id: String(index),
  fields: [...section.body.matchAll(/\[[^\]]+\]/g)].map((match, fieldIndex) => {
    const token = match[0]
    const context = section.body.slice(0, match.index).split(/[|;\n]/).at(-1)!.trim()
    return { key: `${index}.${fieldIndex}`, token, label: token.slice(1, -1), context }
  })
}))

export function fillContractSection(section: typeof contractSections[number], contract: ProjectContract) {
  let index = 0
  return section.body.replace(/\[[^\]]+\]/g, token => contract.fields[section.fields[index++]!.key]?.trim() || token)
}

export function createContract(client: Client): ProjectContract {
  const fields = Object.fromEntries(contractSections.flatMap(section => section.fields.map(field => [field.key, ''])))
  const parties = contractSections[0]!
  for (const field of parties.fields) {
    if (field.token.startsWith('[NOM / D')) fields[field.key] = client.name
    if (field.token === '[EMAIL]') fields[field.key] = client.emails[0] ?? ''
  }
  return { version: 1, fields, includeDataProcessing: false, quote: null }
}

export function filledContractSections(contract: ProjectContract) {
  return contractSections.filter(section => contract.includeDataProcessing || !section.title.startsWith('ANNEXE B')).map(section => ({
    title: section.title,
    body: fillContractSection(section, contract)
  }))
}

export function contractMissingFields(contract: ProjectContract) {
  return contractSections.filter(section => contract.includeDataProcessing || !section.title.startsWith('ANNEXE B'))
    .flatMap(section => section.fields.filter(field => !contract.fields[field.key]?.trim()))
}

export function validateContract(value: unknown): ProjectContract | null {
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Le contrat est invalide.')
  const input = value as Record<string, unknown>
  if (input.version !== 1 || typeof input.includeDataProcessing !== 'boolean'
    || !input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields)) throw new Error('Le contrat est invalide.')
  const source = input.fields as Record<string, unknown>
  const fields: Record<string, string> = {}
  for (const field of contractSections.flatMap(section => section.fields)) {
    const content = source[field.key] ?? ''
    if (typeof content !== 'string' || content.length > 20000) throw new Error(`Le champ « ${field.label} » est invalide (20 000 caractères maximum).`)
    fields[field.key] = content
  }
  let quote: ProjectContract['quote'] = null
  if (input.quote !== null) {
    if (!input.quote || typeof input.quote !== 'object' || Array.isArray(input.quote)) throw new Error('Le devis est invalide.')
    const file = input.quote as Record<string, unknown>
    if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > 255
      || typeof file.data !== 'string' || file.data.length > 7_000_000
      || !/^JVBERi0[A-Za-z0-9+/]*={0,2}$/.test(file.data)) throw new Error('Le devis doit être un PDF de 5 Mo maximum.')
    quote = { name: file.name, data: file.data }
  }
  return { version: 1, fields, includeDataProcessing: input.includeDataProcessing, quote }
}
