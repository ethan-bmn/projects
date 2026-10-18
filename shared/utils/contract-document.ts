import template from '../contract-template.json'
import type { ProjectContract } from '../types/contracts'
import { backups, choice, clientCodeOwnershipClause, consumer, dataProcessing, development, hasService, hosting, maintenance, optionLabel, security, selected, sla, support } from './contract-configuration'

export interface ContractDocumentSection {
  title: string
  body: string
  signature?: boolean
  document?: 'contract' | 'hosting' | 'gdpr'
}

export interface ContractDocument {
  kind: 'contract' | 'hosting' | 'gdpr'
  title: string
  sections: ContractDocumentSection[]
}

export function groupContractDocuments(sections: ContractDocumentSection[]): ContractDocument[] {
  const titles = {
    contract: 'Contrat de prestation',
    hosting: 'Annexe technique d’hébergement',
    gdpr: 'Accord de sous-traitance RGPD'
  }
  const documents: ContractDocument[] = []
  for (const section of sections) {
    const kind = section.document ?? 'contract'
    let document = documents.find(document => document.kind === kind)
    if (!document) {
      document = { kind, title: titles[kind], sections: [] }
      documents.push(document)
    }
    document.sections.push(section)
  }
  return documents
}

export function configuredContractSections(contract: ProjectContract): ContractDocumentSection[] {
  const config = contract.configuration!
  const value = (key: string) => contract.fields[key]?.trim() || `{{${key}}}`
  const label = (key: string) => optionLabel(config, key) || `{{${key}}}`
  const technical = hosting(config) || maintenance(config) || security(config) || backups(config) || support(config) || hasService(config, 'SUPERVISION', 'RESTAURATION')
  const annexes: { name: string, title: string }[] = []
  function annex(name: string, title: string, active: boolean) {
    if (!active) return ''
    const letter = String.fromCharCode(65 + annexes.length)
    annexes.push({ name, title: `Annexe ${letter} — ${title}` })
    return letter
  }
  const technicalAnnex = annex('technical', 'Fiche de service, disponibilité et sauvegardes', technical)
  const dataAnnex = annex('data', 'Accord de traitement des données personnelles', dataProcessing(config))
  const sections: ContractDocumentSection[] = []
  let document: ContractDocumentSection['document'] = 'contract'
  const add = (title: string, body: string, signature = false) => sections.push({ title, body, signature, document })
  function original(index: number, replacements: string[] = []) {
    let field = 0
    return template[index]!.body.replace(/\[[^\]]+\]/g, () => replacements[field++] ?? '').replaceAll('annexe A', `annexe ${technicalAnnex}`).replaceAll('annexe B', `annexe ${dataAnnex}`)
  }
  const paragraphs = (index: number) => template[index]!.body.split(/\n/).filter(paragraph => paragraph.trim())
  function article(index: number, body: string, title = template[index + 1]!.title) {
    add(title, body)
  }

  const entityType = choice(config, 'client.entity_type')
  const clientQuality = choice(config, 'client.qualite')
  const clientName = entityType === 'natural_person'
    ? value('client.nom')
    : value('client.nom')
  const registration = value('client.immatriculation')
  let clientIdentity = entityType === 'natural_person'
    ? `${clientName}, ${clientQuality === 'sole_proprietor' ? `entrepreneur individuel (EI), immatriculé sous le numéro SIREN ${value('client.siren')}, ` : ''}domicilié(e) au ${value('client.adresse')}`
    : `${clientName}, ${value('client.forme_juridique')}${registration ? `, ${registration}` : ''}, dont le siège social est situé au ${value('client.adresse')}, représenté(e) par ${value('client.representant')} en qualité de ${value('client.fonction_representant')}`
  if (value('client.email')) clientIdentity += `, e-mail ${value('client.email')}`
  const contractingCapacity = choice(config, 'client.contracting_capacity') === 'consumer' || choice(config, 'client.type') === 'CONSOMMATEUR'
    ? 'Particulier'
    : choice(config, 'client.contracting_capacity') === 'professional' ? 'Professionnel' : ''
  if (contractingCapacity) clientIdentity += `. Capacité contractuelle : ${contractingCapacity}`
  clientIdentity += ', ci-après « le Client ». '
  add('Entre les parties', `${paragraphs(0)[0]}\n${clientIdentity}\nLe Prestataire et le Client sont ci-après désignés ensemble « les Parties ».`)
  const documents = [`le devis accepté n° ${value('devis.reference')} du ${value('devis.date')}`, 'le cahier des charges et les livrables annexés', ...annexes.map(annex => annex.title.toLowerCase())]
  add('Préambule - Documents contractuels', `Contrat n° ${value('contrat.reference')} du ${value('contrat.date')}.\nLe présent contrat encadre les prestations expressément commandées par le Client. Font partie intégrante du contrat : ${documents.map((document, index) => `(${index + 1}) ${document}`).join(' ; ')}.\nEn cas de contradiction, l’ordre de priorité est : avenant signé, devis et conditions particulières${dataProcessing(config) ? `, annexe ${dataAnnex} pour les traitements de données` : ''}, présent contrat, autres annexes, cahier des charges ; sous réserve des dispositions impératives applicables.`)
  article(1, `Prestations souscrites : ${label('services')}.\nPérimètre et livrables : ${value('perimetre')}.\nAucune autre prestation n’est incluse du seul fait qu’elle est mentionnée dans le présent contrat : seules celles retenues dans le devis et ses annexes sont dues.\n${paragraphs(2).at(-1)}`)

  let execution = paragraphs(3)[0]!
  if (development(config)) {
    execution += `\nMode de réalisation : ${label('developpement.mode')}.`
    if (choice(config, 'recette.active') === 'OUI') execution += `\n${original(3, [value('recette.delai')]).split('\n').slice(1).join('\n')}`
    if (choice(config, 'garantie.active') === 'OUI') execution += `\nMaintenance corrective incluse après livraison : ${value('garantie.duree')}.`
  }
  article(2, execution)
  let payment = `${paragraphs(4)[0]}\nConditions convenues : ${value('prix.conditions')}.`
  // The template reserves late-payment penalties for professional clients.
  if (['PRO_ENTREPRISE', 'PRO_INDEPENDANT'].includes(choice(config, 'client.type'))) payment += `\n${paragraphs(4)[1]!.split('Pour les consommateurs')[0]!.trim()}`
  if (consumer(config)) payment += `\n${value('consommateur.informations')}\nLes règles impératives applicables aux consommateurs priment.`
  // Remove the template author's instruction to adapt the VAT mention; the actual regime is entered above.
  payment = payment.replace(/Mention TVA à adapter[^\n]+/, '')
  article(3, payment)
  if (hosting(config)) article(4, `${original(5)}\nOffre : ${label('hebergement.mode')}. Durée : ${value('hebergement.duree')}. Prix : ${value('hebergement.prix')}.\n${choice(config, 'hebergement.mode') === 'PAYANT_RECURRENT' ? `Périodicité : ${choice(config, 'hebergement.periodicite') === 'AUTRE' ? value('hebergement.periodicite_autre') : label('hebergement.periodicite')}.` : ''}`)
  if (hosting(config) || support(config) || hasService(config, 'SUPERVISION')) {
    const availability: string[] = []
    if (hosting(config)) {
      if (sla(config)) availability.push(`L’engagement chiffré de disponibilité, sa méthode de calcul, les exclusions et les recours sont exclusivement définis en annexe ${technicalAnnex}.`)
      else availability.push('En l’absence d’un engagement chiffré expressément souscrit, le Prestataire s’engage à mettre en œuvre des moyens raisonnables pour assurer la continuité du service, sans garantir une disponibilité ininterrompue.')
      availability.push(paragraphs(6)[1]!)
    }
    if (support(config)) availability.push(`Les incidents sont signalés via ${value('support.canaux')}, selon les plages de support de l’annexe ${technicalAnnex}. Accusé de réception : ${value('support.accuse')}. Les délais de prise en charge ne constituent pas des délais de résolution.`)
    if (hasService(config, 'SUPERVISION')) availability.push(`Supervision souscrite : ${value('supervision.conditions')}.`)
    article(5, availability.join('\n'))
  }
  if (maintenance(config) || security(config)) {
    const operations: string[] = []
    if (security(config)) operations.push(`Mesures effectivement appliquées : ${label('securite')}.\n${paragraphs(7)[1]}\nCorrectifs critiques : ${value('securite.correctifs')}. Responsabilités du Client : ${value('securite.client')}.`)
    if (maintenance(config)) operations.push(`Maintenance souscrite : ${label('maintenance')}.\n${paragraphs(7)[2]}\nFenêtre et préavis : ${value('maintenance.fenetre')}.`)
    article(6, operations.join('\n'))
  }
  if (backups(config)) article(7, original(8))
  let confidentiality = original(9, [value('confidentialite.duree')])
  if (!dataProcessing(config)) confidentiality = confidentiality.split('\n')[0]!
  article(8, confidentiality)
  article(9, clientCodeOwnershipClause, 'Article 9 - Propriété intellectuelle et code source')
  if (hasService(config, 'DNS', 'NOM_DE_DOMAINE')) article(10, `${original(11)}\nConditions convenues : ${value('domaine.conditions')}.`)
  const duration = choice(config, 'contrat.duree.mode')
  let term = duration === 'PONCTUELLE'
    ? 'La prestation ponctuelle prend fin après exécution des obligations correspondantes.'
    : `Les services récurrents sont souscrits ${duration === 'DUREE_DETERMINEE' ? `pour ${value('contrat.duree')}` : 'pour une durée indéterminée'}, à compter du ${value('contrat.debut')}. Renouvellement : ${label('contrat.renouvellement')}. Préavis et canal de résiliation : ${value('contrat.preavis')}.`
  if (consumer(config)) term += '\nLes dispositions impératives relatives à la reconduction et à la résiliation applicables aux consommateurs restent applicables.'
  term += `\nEn cas de manquement grave, la résiliation peut intervenir selon une procédure de mise en demeure et un délai de régularisation de ${value('contrat.regularisation')} jours, sauf urgence justifiée ou règles impératives contraires. Une suspension doit être proportionnée et précédée d’une information lorsque possible.`
  term += `\nÀ la fin du contrat : export ${value('reversibilite.format')}, délai de demande ${value('reversibilite.delai')} jours, effacement des données opérationnelles ${value('reversibilite.effacement')}, sous réserve des obligations légales de conservation. Réversibilité : ${label('reversibilite.mode')}.`
  if (choice(config, 'reversibilite.mode') !== 'EXPORT_SIMPLE') term += `\nAssistance : ${value('reversibilite.assistance')}.`
  if (backups(config)) term += `\nSuppression des sauvegardes résiduelles : ${value('reversibilite.sauvegardes')}.`
  article(11, term)
  article(12, original(13, [value('assurance')]))
  article(13, original(14))
  article(14, `Toute réclamation est adressée en priorité à ${value('reclamations')}. Les Parties recherchent une solution amiable avant toute procédure, sans priver quiconque de ses recours légaux.${consumer(config) ? `\nMédiateur de la consommation : ${value('mediateur')}.` : ''}\nLes règles impératives de compétence juridictionnelle s’appliquent.`)
  add(template[16]!.title, `Les Parties déclarent avoir pris connaissance du contrat n° ${value('contrat.reference')} et de ses annexes, et accepter expressément les prestations et conditions particulières figurant au devis.\nSigné à ____________________, le ____________________.\nLe Prestataire : Ethan BAUMANN EI — Signature : ____________________\nLe Client : ${value('client.nom')} — Signature : ____________________`, true)

  let technicalIndex = 0
  function technicalSection(title: string, body: string) {
    add(`${technicalAnnex}.${++technicalIndex} ${title}`, body)
  }
  for (const entry of annexes) {
    document = entry.name === 'technical' ? 'hosting' : 'gdpr'
    add(entry.title, '')
    if (entry.name === 'technical') {
      if (hosting(config)) {
        technicalSection('Identification et hébergement', `Client : ${value('client.nom')}. Service / domaine : ${value('service.domaine')}. Environnement : ${value('service.environnement')}. Activation : ${value('service.activation')}.\nInfrastructure : ${choice(config, 'hebergement.infrastructure') === 'AUTRE' ? value('hebergement.infrastructure_autre') : label('hebergement.infrastructure')}. Fournisseur : ${value('hebergeur.nom')}. Région : ${value('hebergeur.region')}.\nOffre : ${label('hebergement.mode')}. Prix : ${value('hebergement.prix')}. Durée : ${value('hebergement.duree')}.${choice(config, 'hebergement.mode') === 'OFFERT_DUREE_DEFINIE' ? ` Fin de la gratuité : ${value('hebergement.fin')}.` : ''}`)
      }
      if (hosting(config) || maintenance(config) || support(config)) technicalSection('Offre et périmètre', `Services inclus : ${label('services')}. Exclusions : ${value('service.exclusions')}.`)
      if (sla(config)) technicalSection('Disponibilité garantie', `Disponibilité mensuelle garantie : ${value('sla.pourcentage')} %.\nDisponibilité = (minutes éligibles − minutes d’indisponibilité imputables au périmètre garanti) / minutes éligibles × 100. Mesure : ${value('sla.mesure')}. Période : mois civil, ${value('sla.fuseau')}. Exclusions : ${value('sla.exclusions')}. Compensation / remède : ${value('sla.compensation')}.`)
      if (support(config)) technicalSection('Support et incidents', `Support : ${label('support.mode')}, ${value('support.horaires')}, fuseau ${value('support.fuseau')}. Canaux : ${value('support.canaux')}.\nAccusé de réception : ${value('support.accuse')}. Prise en charge : P1 (service indisponible) ${value('support.p1')} ; P2 (dégradation) ${value('support.p2')} ; P3 (demande mineure) ${value('support.p3')}. Résolution : ${value('support.resolution')}.`)
      if (hasService(config, 'SUPERVISION')) technicalSection('Supervision', value('supervision.conditions'))
      if (maintenance(config)) technicalSection('Maintenance', `Opérations incluses : ${label('maintenance')}. Fenêtre et préavis : ${value('maintenance.fenetre')}.`)
      if (security(config)) technicalSection('Sécurité', `Mesures effectivement appliquées : ${label('securite')}. Correctifs critiques : ${value('securite.correctifs')}. Responsabilités du Client : ${value('securite.client')}.`)
      if (backups(config)) technicalSection('Sauvegardes tournantes', `Offre : ${label('backups.mode')}. Données : ${label('backups.donnees')}${selected(config, 'backups.donnees').includes('AUTRE') ? ` (${value('backups.autre')})` : ''}. Exclusions : ${value('backups.exclusions')}.\nType : ${label('backups.type')}. Fréquence : ${value('backups.frequence')}. Rétention : ${value('backups.retentions')}. Destination : ${value('backups.localisation')}.\nOptions retenues : ${optionLabel(config, 'backups.options') || 'Aucune option supplémentaire'}. Contrôles : ${value('backups.controle')}. Tests de restauration : ${value('backups.test_restauration')}. En cas d’échec : ${value('backups.echec')}. Suppression des versions expirées : ${value('backups.expiration')}.\nRPO : ${choice(config, 'backups.rpo.mode') === 'GARANTI' ? value('backups.rpo') : 'Non garanti'}. RTO : ${choice(config, 'backups.rto.mode') === 'GARANTI' ? value('backups.rto') : 'Non garanti'}. Restauration : ${label('backups.restauration')}. Coût et délai : ${value('backups.restauration_conditions')}.\nSuppression en fin de service : ${value('reversibilite.sauvegardes')}.`)
      if (hasService(config, 'RESTAURATION')) technicalSection('Prestation de restauration', value('restauration.conditions'))
    }
    if (entry.name === 'data') {
      const dataFields = [
        ['Responsable de traitement', 'responsable'], ['Sous-traitant', 'sous_traitant'], ['Objet, nature et finalités', 'finalites'],
        ['Durée', 'duree'], ['Personnes concernées', 'personnes'], ['Types de données', 'donnees'], ['Instructions documentées', 'instructions'],
        ['Sous-traitants ultérieurs', 'sous_traitants'], ['Confidentialité et sécurité', 'securite'], ['Assistance', 'assistance'],
        ['Violations', 'violations'], ['Audits', 'audits'], ['Fin de mission', 'fin'], ['Transferts internationaux', 'transferts']
      ]
      sections[sections.length - 1]!.body = dataFields.map(([label, key]) => `${label} : ${value(`rgpd.${key}`)}`).join('\n')
    }
  }
  let articleNumber = 0
  return sections.map(section => ({ ...section, title: section.title.replace(/^Article \d+/, () => `Article ${++articleNumber}`) }))
}
