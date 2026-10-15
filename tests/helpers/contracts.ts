import type { Client } from '../../shared/types/clients'
import type { ProjectContract } from '../../shared/types/contracts'
import { createContract } from '../../shared/utils/contracts'
import { activeContractVariables, contractConfirmations } from '../../shared/utils/contract-configuration'

export const contractClient: Client & { active: boolean } = {
  id: 'client', abbyId: 'abby', kind: 'organization', name: 'Atelier Éloïse',
  emails: ['client@example.test'], commercialName: null, billingAddress: null, active: true
}

export function completeContract(contract: ProjectContract) {
  const config = contract.configuration!
  for (const field of activeContractVariables(config)) {
    contract.fields[field.key] ||= field.type === 'number' ? '5' : field.type === 'date' ? '2026-10-15' : `Conditions de ${field.label}`
  }
  contract.fields['client.siren'] = '123456789'
  contract.fields['contrat.reference'] = 'C-2026-001'
  contract.fields['devis.reference'] = 'DEV-2026-001'
  contract.fields['devis.date'] = '15/10/2026'
  if (config.choices['hebergement.mode'] === 'OFFERT_DUREE_DEFINIE') contract.fields['hebergement.prix'] = '0'
  if (config.choices['sla.mode'] === 'SLA_CHIFFRE') contract.fields['sla.pourcentage'] = '99.5'
  for (const field of contractConfirmations) config.confirmations[field.key] = true
  contract.includeDataProcessing = config.choices['rgpd.sous_traitance'] === 'OUI'
  contract.quote = { name: 'devis.pdf', data: 'JVBERi0xLjQ=' }
  return contract
}

export function auditContract() {
  const contract = createContract(contractClient)
  Object.assign(contract.configuration!.choices, { 'contrat.duree.mode': 'PONCTUELLE', 'reversibilite.mode': 'EXPORT_SIMPLE', 'rgpd.sous_traitance': 'NON' })
  contract.configuration!.selections.services = ['AUDIT']
  return completeContract(contract)
}

export function fullContract() {
  const contract = auditContract()
  Object.assign(contract.configuration!.choices, {
    'developpement.mode': 'FORFAIT', 'recette.active': 'OUI', 'droits.mode': 'LICENCE', 'source_code.livraison': 'OUI', 'garantie.active': 'OUI',
    'hebergement.mode': 'PAYANT_RECURRENT', 'hebergement.periodicite': 'MENSUELLE', 'hebergement.infrastructure': 'VPS_MUTUALISE',
    'sla.mode': 'SLA_CHIFFRE', 'support.mode': 'HEURES_OUVREES', 'backups.mode': 'INCLUSES', 'backups.type': 'SNAPSHOTS',
    'backups.restauration': 'RESTAURATION_INCLUSE', 'contrat.duree.mode': 'DUREE_DETERMINEE', 'contrat.renouvellement': 'AUCUN',
    'rgpd.sous_traitance': 'OUI'
  })
  Object.assign(contract.configuration!.selections, {
    'services': ['DEVELOPPEMENT', 'HEBERGEMENT', 'MAINTENANCE_CORRECTIVE', 'SECURITE', 'SUPERVISION', 'SAUVEGARDES', 'SUPPORT', 'DNS', 'RESTAURATION'],
    'maintenance': ['MISE_A_JOUR_APPLICATION'], 'securite': ['PARE_FEU', 'MFA_ADMIN'], 'backups.donnees': ['FICHIERS', 'BASE_DE_DONNEES'],
    'backups.options': ['STOCKAGE_DISTANT', 'CHIFFREMENT_EN_TRANSIT']
  })
  return completeContract(contract)
}
