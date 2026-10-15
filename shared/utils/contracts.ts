import template from '../contract-template.json'
import type { Client } from '../types/clients'
import type { ContractConfiguration, ProjectContract } from '../types/contracts'
import { formatClientAddress } from './client-address'
import { activeContractVariables, backups, choice, contractChoices, contractConfirmations, contractVariables, dataProcessing, defaultConfiguration, development, hasService, hosting, selected, support } from './contract-configuration'
import { configuredContractSections } from './contract-document'
import type { ContractDocumentSection } from './contract-document'

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
  const fields = Object.fromEntries(contractVariables.map(field => [field.key, '']))
  fields['client.nom'] = client.name
  fields['client.email'] = client.emails[0] ?? ''
  fields['client.adresse'] = formatClientAddress(client.billingAddress)
  fields['rgpd.responsable'] = client.name
  fields['rgpd.sous_traitant'] = 'Ethan BAUMANN EI'
  fields.reclamations = 'contact@ethanbaumann.fr — 248 rue André Philip, 69003 Lyon'
  const configuration = defaultConfiguration()
  if (client.kind === 'organization') configuration.choices['client.type'] = 'PRO_ENTREPRISE'
  return { version: 2, fields, configuration, includeDataProcessing: false, quote: null }
}

export function upgradeContract(contract: ProjectContract | null | undefined, client: Client): ProjectContract {
  if (!contract) return createContract(client)
  if (contract.version === 2) return structuredClone(contract)
  const updated = createContract(client)
  updated.quote = contract.quote ? { ...contract.quote } : null
  // Keep every legacy value, including those that need manual classification under the new choices.
  Object.assign(updated.fields, contract.fields)
  for (const variable of contractVariables) {
    const saved = variable.legacy ? contract.fields[variable.legacy] : ''
    if (saved?.trim()) updated.fields[variable.key] = saved
  }
  const date = updated.fields['contrat.date']?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (date) updated.fields['contrat.date'] = `${date[3]}-${date[2]}-${date[1]}`
  if (contract.includeDataProcessing) {
    updated.configuration!.choices['rgpd.sous_traitance'] = 'OUI'
    updated.includeDataProcessing = true
  }
  return updated
}

export function filledContractSections(contract: ProjectContract): ContractDocumentSection[] {
  if (contract.version === 2 && contract.configuration) return configuredContractSections(contract)
  return contractSections.filter(section => contract.includeDataProcessing || !section.title.startsWith('ANNEXE B')).map(section => ({
    title: section.title,
    body: fillContractSection(section, contract)
  }))
}

export function contractMissingFields(contract: ProjectContract) {
  if (contract.version === 2 && contract.configuration) {
    return activeContractVariables(contract.configuration).filter(field => !field.optional && !contract.fields[field.key]?.trim())
  }
  return contractSections.filter(section => contract.includeDataProcessing || !section.title.startsWith('ANNEXE B'))
    .flatMap(section => section.fields.filter(field => !contract.fields[field.key]?.trim()))
}

export function contractExportIssues(contract: ProjectContract): string[] {
  if (contract.version !== 2 || !contract.configuration) return ['Ouvrez et enregistrez le contrat avec le nouveau paramétrage avant l’export.']
  const config = contract.configuration
  const issues = contractMissingFields(contract).map(field => `À renseigner : ${field.label}.`)
  for (const field of contractChoices) {
    if (field.when && !field.when(config)) continue
    if (field.multiple) {
      if (['services', 'maintenance', 'securite', 'backups.donnees'].includes(field.key) && !selected(config, field.key).length) issues.push(`Sélectionnez au moins une valeur : ${field.label}.`)
    } else if (!choice(config, field.key)) issues.push(`Choisissez : ${field.label}.`)
  }
  if (choice(config, 'rgpd.sous_traitance') === 'A_QUALIFIER') issues.push('Qualifiez le traitement des données personnelles avant l’export.')
  if (development(config) && choice(config, 'droits.mode') === 'A_DEFINIR') issues.push('Définissez la licence ou la cession des droits avant l’export.')
  if (hosting(config) && choice(config, 'hebergement.mode') === 'NON_INCLUS') issues.push('Le service Hébergement est sélectionné mais son offre est « Non inclus ».')
  if (support(config) && choice(config, 'support.mode') === 'SANS_SUPPORT') issues.push('Le service Support est sélectionné mais ses plages sont « Sans support ».')
  if (hasService(config, 'SAUVEGARDES') && !backups(config)) issues.push('Le service Sauvegardes est sélectionné mais son offre est « Absentes ».')
  const assisted = ['ASSISTANCE_PAYANTE', 'ASSISTANCE_INCLUSE'].includes(choice(config, 'reversibilite.mode'))
  if (assisted !== hasService(config, 'REVERSIBILITE_ASSISTEE')) issues.push('La prestation de réversibilité assistée doit correspondre au mode de réversibilité choisi.')
  if (hosting(config) && choice(config, 'hebergement.mode') === 'OFFERT_DUREE_DEFINIE' && Number(contract.fields['hebergement.prix']) !== 0) issues.push('Le prix d’un hébergement offert doit être 0.')
  if (hosting(config) && choice(config, 'hebergement.mode') === 'PAYANT_RECURRENT' && choice(config, 'contrat.duree.mode') === 'PONCTUELLE') issues.push('Un hébergement payant récurrent nécessite une durée récurrente du contrat.')
  if (choice(config, 'contrat.duree.mode') === 'INDETERMINEE' && ['TACITE', 'EXPRES'].includes(choice(config, 'contrat.renouvellement'))) issues.push('Un contrat à durée indéterminée ne doit pas prévoir un renouvellement de période.')
  for (const field of activeContractVariables(config)) {
    const content = contract.fields[field.key]?.trim()
    if (!content) continue
    if (/\{\{|\}\}|\[[^\]]+\]/.test(content)) issues.push(`Variable ou marqueur non résolu : ${field.label}.`)
    if (field.type === 'number') {
      const number = Number(content)
      if (!Number.isFinite(number) || number < 0 || (field.key !== 'hebergement.prix' && field.key !== 'sla.pourcentage' && (!Number.isInteger(number) || number < 1))) issues.push(`Valeur numérique invalide : ${field.label}.`)
      if (field.key === 'sla.pourcentage' && (number <= 0 || number > 100)) issues.push('La disponibilité garantie doit être comprise entre 0 et 100 % (0 exclu).')
    }
    if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(content) || !Number.isFinite(Date.parse(content)) || new Date(content).toISOString().slice(0, 10) !== content)) issues.push(`Date invalide : ${field.label}.`)
  }
  if (professionalSirenRequired(config) && !/^\d{9}$/.test(contract.fields['client.siren']?.replace(/\s/g, '') ?? '')) issues.push('Le SIREN du client doit comporter 9 chiffres.')
  if (!contract.quote) issues.push('Joignez le devis PDF accepté.')
  for (const confirmation of contractConfirmations) {
    if ((!confirmation.when || confirmation.when(config)) && !config.confirmations[confirmation.key]) issues.push(`À vérifier : ${confirmation.label}.`)
  }
  if (configuredContractSections(contract).some(section => /\{\{[^}]+\}\}|\[[^\]]+\]/.test(section.body))) issues.push('Le document contient encore des variables non résolues.')
  return [...new Set(issues)]
}

function professionalSirenRequired(config: ContractConfiguration) {
  return ['PRO_ENTREPRISE', 'PRO_INDEPENDANT'].includes(choice(config, 'client.type'))
}

function validateConfiguration(value: unknown): ContractConfiguration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Le paramétrage du contrat est invalide.')
  const source = value as Record<string, unknown>
  const object = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Le paramétrage du contrat est invalide.')
    return value as Record<string, unknown>
  }
  const choices = object(source.choices)
  const selections = object(source.selections)
  const confirmations = object(source.confirmations)
  const config = defaultConfiguration()
  for (const field of contractChoices) {
    if (field.multiple) {
      const values = selections[field.key] ?? []
      if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !field.options.some(option => option.value === value))) throw new Error(`Choix invalide : ${field.label}.`)
      config.selections[field.key] = [...new Set(values)]
    } else {
      const value = choices[field.key] ?? config.choices[field.key]!
      if (typeof value !== 'string' || (value !== '' && !field.options.some(option => option.value === value))) throw new Error(`Choix invalide : ${field.label}.`)
      config.choices[field.key] = value
    }
  }
  for (const field of contractConfirmations) {
    const value = confirmations[field.key] ?? false
    if (typeof value !== 'boolean') throw new Error('Les vérifications du contrat sont invalides.')
    config.confirmations[field.key] = value
  }
  return config
}

export function validateContract(value: unknown): ProjectContract | null {
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Le contrat est invalide.')
  const input = value as Record<string, unknown>
  if (![1, 2].includes(input.version as number) || typeof input.includeDataProcessing !== 'boolean'
    || !input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields)) throw new Error('Le contrat est invalide.')
  const source = input.fields as Record<string, unknown>
  const fields: Record<string, string> = {}
  const legacyFields = contractSections.flatMap(section => section.fields)
  const acceptedFields = input.version === 1 ? legacyFields : [...contractVariables, ...legacyFields.filter(field => Object.hasOwn(source, field.key))]
  for (const field of acceptedFields) {
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
  const configuration = input.version === 2 ? validateConfiguration(input.configuration) : undefined
  return {
    version: input.version as 1 | 2, fields, quote,
    includeDataProcessing: configuration ? dataProcessing(configuration) : input.includeDataProcessing,
    ...(configuration ? { configuration } : {})
  }
}
