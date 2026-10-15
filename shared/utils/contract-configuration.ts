import type { ContractConfiguration } from '../types/contracts'

type Condition = (config: ContractConfiguration) => boolean
export interface ContractChoice {
  key: string
  label: string
  group: number
  multiple: boolean
  options: { value: string, label: string }[]
  when?: Condition
  default?: string
}
export interface ContractVariable {
  key: string
  label: string
  group: number
  type: 'text' | 'textarea' | 'date' | 'number'
  when?: Condition
  legacy?: string
  optional?: boolean
}

export const contractGroups = [
  'Identité du client et cadre juridique', 'Prestations souscrites',
  'Développement et propriété intellectuelle', 'Hébergement et facturation',
  'Disponibilité et support', 'Maintenance et sécurité', 'Sauvegardes',
  'Durée, réversibilité et données personnelles', 'Vérifications avant export'
]

export const choice = (config: ContractConfiguration, key: string) => config.choices[key] ?? ''
export const selected = (config: ContractConfiguration, key: string) => config.selections[key] ?? []
export const hasService = (config: ContractConfiguration, ...services: string[]) => services.some(service => selected(config, 'services').includes(service))
export const hosting: Condition = config => hasService(config, 'HEBERGEMENT')
export const development: Condition = config => hasService(config, 'CONCEPTION', 'DEVELOPPEMENT')
export const maintenance: Condition = config => hasService(config, 'MAINTENANCE_CORRECTIVE', 'MAINTENANCE_EVOLUTIVE')
export const security: Condition = config => hasService(config, 'SECURITE')
export const backups: Condition = config => hasService(config, 'SAUVEGARDES') && ['INCLUSES', 'OPTION_PAYANTE'].includes(choice(config, 'backups.mode'))
export const support: Condition = config => hasService(config, 'SUPPORT')
export const sla: Condition = config => hosting(config) && choice(config, 'sla.mode') === 'SLA_CHIFFRE'
export const consumer: Condition = config => choice(config, 'client.type') === 'CONSOMMATEUR'
export const professional: Condition = config => ['PRO_ENTREPRISE', 'PRO_INDEPENDANT'].includes(choice(config, 'client.type'))
export const dataProcessing: Condition = config => choice(config, 'rgpd.sous_traitance') === 'OUI'
export const assignment: Condition = config => development(config) && choice(config, 'droits.mode') === 'CESSION_SPECIFIQUE'
const recurring: Condition = config => ['DUREE_DETERMINEE', 'INDETERMINEE'].includes(choice(config, 'contrat.duree.mode'))
const guaranteed = (key: string): Condition => config => backups(config) && choice(config, key) === 'GARANTI'

function options(values: [string, string][]) {
  return values.map(([value, label]) => ({ value, label }))
}
function single(key: string, label: string, group: number, values: [string, string][], when?: Condition, defaultValue?: string): ContractChoice {
  return { key, label, group, multiple: false, options: options(values), when, default: defaultValue }
}
function multiple(key: string, label: string, group: number, values: [string, string][], when?: Condition): ContractChoice {
  return { key, label, group, multiple: true, options: options(values), when }
}
const yesNo: [string, string][] = [['OUI', 'Oui'], ['NON', 'Non']]

export const contractChoices: ContractChoice[] = [
  single('client.type', 'Type de client', 0, [['PRO_ENTREPRISE', 'Entreprise'], ['PRO_INDEPENDANT', 'Professionnel indépendant'], ['CONSOMMATEUR', 'Particulier'], ['ASSOCIATION', 'Association'], ['AUTRE', 'Autre']]),
  single('client.vente', 'Cadre de la vente', 0, [['VENTE_A_DISTANCE', 'Vente à distance'], ['VENTE_HORS_ETABLISSEMENT', 'Vente hors établissement'], ['VENTE_EN_ETABLISSEMENT', 'Vente en établissement']], consumer),
  multiple('services', 'Services commandés au devis', 1, [
    ['AUDIT', 'Audit'], ['CONCEPTION', 'Conception'], ['DEVELOPPEMENT', 'Développement'], ['DEPLOIEMENT', 'Déploiement'],
    ['HEBERGEMENT', 'Hébergement'], ['MAINTENANCE_CORRECTIVE', 'Maintenance corrective'], ['MAINTENANCE_EVOLUTIVE', 'Maintenance évolutive'],
    ['SECURITE', 'Sécurité'], ['SUPERVISION', 'Supervision'], ['SAUVEGARDES', 'Sauvegardes'], ['RESTAURATION', 'Restauration'],
    ['DNS', 'DNS'], ['NOM_DE_DOMAINE', 'Nom de domaine'], ['SUPPORT', 'Support'], ['REVERSIBILITE_ASSISTEE', 'Réversibilité assistée']
  ]),
  single('developpement.mode', 'Mode de réalisation', 2, [['FORFAIT', 'Forfait'], ['REGIE', 'Régie'], ['MIXTE', 'Mixte']], development),
  single('recette.active', 'Procédure de recette', 2, yesNo, development),
  single('droits.mode', 'Droits sur les créations', 2, [['LICENCE', 'Licence d’utilisation'], ['CESSION_SPECIFIQUE', 'Cession spécifique avec annexe'], ['A_DEFINIR', 'À définir']], development, 'A_DEFINIR'),
  single('source_code.livraison', 'Livraison du code source', 2, yesNo, development),
  single('garantie.active', 'Maintenance corrective incluse après livraison', 2, yesNo, development),
  single('hebergement.mode', 'Offre d’hébergement', 3, [['NON_INCLUS', 'Non inclus'], ['PAYANT_RECURRENT', 'Payant récurrent'], ['OFFERT_DUREE_DEFINIE', 'Offert pour une durée définie'], ['INCLUS_DANS_FORFAIT', 'Inclus dans le forfait']], hosting, 'NON_INCLUS'),
  single('hebergement.periodicite', 'Périodicité de facturation', 3, [['MENSUELLE', 'Mensuelle'], ['ANNUELLE', 'Annuelle'], ['AUTRE', 'Autre']], config => hosting(config) && choice(config, 'hebergement.mode') === 'PAYANT_RECURRENT'),
  single('hebergement.infrastructure', 'Infrastructure', 3, [['VPS_MUTUALISE', 'VPS mutualisé'], ['VPS_DEDIE_CLIENT', 'VPS dédié au client'], ['AUTRE', 'Autre']], hosting),
  single('sla.mode', 'Engagement de disponibilité', 4, [['AUCUN_ENGAGEMENT_CHIFFRE', 'Aucun engagement chiffré'], ['SLA_CHIFFRE', 'SLA chiffré']], hosting, 'AUCUN_ENGAGEMENT_CHIFFRE'),
  single('support.mode', 'Plages de support', 4, [['SANS_SUPPORT', 'Sans support'], ['HEURES_OUVREES', 'Heures ouvrées'], ['ETENDU', 'Étendu'], ['24_7', '24 h / 24, 7 j / 7']], support, 'SANS_SUPPORT'),
  multiple('maintenance', 'Opérations de maintenance incluses', 5, [['PATCH_SECURITE', 'Correctifs de sécurité'], ['MISE_A_JOUR_SYSTEME', 'Mises à jour système'], ['MISE_A_JOUR_APPLICATION', 'Mises à jour applicatives'], ['SURVEILLANCE_DISPONIBILITE', 'Surveillance de disponibilité'], ['CERTIFICATS_TLS', 'Certificats TLS'], ['JOURNAUX', 'Journaux'], ['REPONSE_INCIDENT', 'Réponse aux incidents']], maintenance),
  multiple('securite', 'Mesures de sécurité effectivement opérées', 5, [['PARE_FEU', 'Pare-feu'], ['MFA_ADMIN', 'MFA administrateur'], ['CONTROLE_ACCES', 'Contrôle des accès'], ['CHIFFREMENT_TRANSIT', 'Chiffrement en transit'], ['CHIFFREMENT_REPOS', 'Chiffrement au repos'], ['ISOLATION_SERVICES', 'Isolation des services'], ['GESTION_SECRETS', 'Gestion des secrets']], security),
  single('backups.mode', 'Offre de sauvegardes', 6, [['ABSENTES', 'Absentes'], ['INCLUSES', 'Incluses'], ['OPTION_PAYANTE', 'Option payante']], config => hasService(config, 'SAUVEGARDES'), 'ABSENTES'),
  multiple('backups.donnees', 'Données sauvegardées', 6, [['FICHIERS', 'Fichiers'], ['BASE_DE_DONNEES', 'Base de données'], ['CONFIGURATION', 'Configuration'], ['AUTRE', 'Autre']], backups),
  single('backups.type', 'Type de sauvegarde', 6, [['COMPLETES', 'Complètes'], ['INCREMENTALES', 'Incrémentales'], ['SNAPSHOTS', 'Snapshots']], backups),
  multiple('backups.options', 'Options de stockage et de chiffrement', 6, [['STOCKAGE_DISTANT', 'Stockage distant'], ['COPIE_HORS_SITE', 'Copie hors site'], ['CHIFFREMENT_AU_REPOS', 'Chiffrement au repos'], ['CHIFFREMENT_EN_TRANSIT', 'Chiffrement en transit']], backups),
  single('backups.restauration', 'Restauration des sauvegardes', 6, [['RESTAURATION_INCLUSE', 'Restauration incluse'], ['RESTAURATION_FACTUREE', 'Restauration facturée']], backups),
  single('backups.rpo.mode', 'Perte de données maximale (RPO)', 6, [['NON_GARANTI', 'Non garanti'], ['GARANTI', 'Garanti']], backups, 'NON_GARANTI'),
  single('backups.rto.mode', 'Délai de reprise (RTO)', 6, [['NON_GARANTI', 'Non garanti'], ['GARANTI', 'Garanti']], backups, 'NON_GARANTI'),
  single('contrat.duree.mode', 'Durée du contrat', 7, [['PONCTUELLE', 'Prestation ponctuelle'], ['DUREE_DETERMINEE', 'Durée déterminée'], ['INDETERMINEE', 'Durée indéterminée']]),
  single('contrat.renouvellement', 'Renouvellement', 7, [['AUCUN', 'Aucun'], ['TACITE', 'Tacite'], ['EXPRES', 'Exprès']], recurring),
  single('reversibilite.mode', 'Réversibilité', 7, [['EXPORT_SIMPLE', 'Export simple'], ['ASSISTANCE_PAYANTE', 'Assistance payante'], ['ASSISTANCE_INCLUSE', 'Assistance incluse']]),
  single('rgpd.sous_traitance', 'Traitement de données pour le compte du client', 7, [['OUI', 'Oui — annexe obligatoire'], ['NON', 'Non'], ['A_QUALIFIER', 'À qualifier — export bloqué']], undefined, 'A_QUALIFIER')
]

function variable(key: string, label: string, group: number, type: ContractVariable['type'] = 'textarea', when?: Condition, legacy?: string, optional = false): ContractVariable {
  return { key, label, group, type, when, legacy, optional }
}

export const contractVariables: ContractVariable[] = [
  variable('client.nom', 'Nom ou dénomination du client', 0, 'text', undefined, '0.0'),
  variable('client.adresse', 'Adresse du client', 0, 'textarea', undefined, '0.2'),
  variable('client.email', 'E-mail du client', 0, 'text', undefined, '0.4'),
  variable('client.siren', 'SIREN du client', 0, 'text', professional),
  variable('client.forme', 'Forme juridique', 0, 'text', config => ['PRO_ENTREPRISE', 'ASSOCIATION', 'AUTRE'].includes(choice(config, 'client.type')), '0.1'),
  variable('client.representant', 'Représentant et qualité', 0, 'text', config => ['PRO_ENTREPRISE', 'ASSOCIATION', 'AUTRE'].includes(choice(config, 'client.type')), '0.3'),
  variable('client.autre', 'Préciser le statut du client', 0, 'text', config => choice(config, 'client.type') === 'AUTRE'),
  variable('contrat.reference', 'Référence du contrat', 0, 'text'),
  variable('contrat.date', 'Date du contrat', 0, 'date', undefined, '16.1'),
  variable('devis.reference', 'Référence du devis', 0, 'text', undefined, '1.0'),
  variable('devis.date', 'Date d’émission du devis', 0, 'text', undefined, '1.1'),
  variable('consommateur.informations', 'Informations précontractuelles et droit de rétractation applicables', 0, 'textarea', consumer),
  variable('perimetre', 'Périmètre et livrables convenus au devis', 1),
  variable('domaine.conditions', 'Titulaire, gestionnaire, payeur, renouvellement, transfert et remise des accès', 1, 'textarea', config => hasService(config, 'DNS', 'NOM_DE_DOMAINE')),
  variable('recette.delai', 'Délai de recette en jours ouvrés', 2, 'number', config => development(config) && choice(config, 'recette.active') === 'OUI', '3.0'),
  variable('droits.licence', 'Droits d’utilisation : destination, territoire, durée et rémunération', 2, 'textarea', config => development(config) && choice(config, 'droits.mode') === 'LICENCE'),
  variable('droits.cession', 'Annexe de cession : droits cédés, destination, territoire, durée et rémunération', 2, 'textarea', assignment),
  variable('garantie.duree', 'Durée et périmètre de la maintenance après livraison', 2, 'text', config => development(config) && choice(config, 'garantie.active') === 'OUI'),
  variable('prix.conditions', 'Prix, TVA, échéancier et conditions de paiement convenus au devis', 3),
  variable('hebergement.duree', 'Durée de l’hébergement', 3, 'text', hosting),
  variable('hebergement.prix', 'Prix de l’hébergement (0 si offert)', 3, 'number', hosting),
  variable('hebergement.fin', 'Date ou événement précis mettant fin à la gratuité', 3, 'textarea', config => hosting(config) && choice(config, 'hebergement.mode') === 'OFFERT_DUREE_DEFINIE'),
  variable('hebergement.periodicite_autre', 'Préciser la périodicité', 3, 'text', config => hosting(config) && choice(config, 'hebergement.periodicite') === 'AUTRE' && choice(config, 'hebergement.mode') === 'PAYANT_RECURRENT'),
  variable('hebergement.infrastructure_autre', 'Préciser l’infrastructure', 3, 'text', config => hosting(config) && choice(config, 'hebergement.infrastructure') === 'AUTRE'),
  variable('hebergeur.nom', 'Fournisseur d’infrastructure', 3, 'text', hosting, '18.4'),
  variable('hebergeur.region', 'Pays ou région d’hébergement', 3, 'text', hosting, '18.5'),
  variable('service.domaine', 'Service ou domaine', 3, 'text', hosting, '18.1'),
  variable('service.environnement', 'Environnement', 3, 'text', hosting, '18.2'),
  variable('service.activation', 'Date d’activation', 3, 'text', hosting, '18.3'),
  variable('service.exclusions', 'Exclusions du service', 3, 'textarea', config => hosting(config) || maintenance(config) || support(config), '19.1'),
  variable('sla.pourcentage', 'Disponibilité mensuelle garantie (%)', 4, 'number', sla),
  variable('sla.mesure', 'Source et fréquence de mesure', 4, 'textarea', sla, '20.1'),
  variable('sla.exclusions', 'Exclusions précises du SLA', 4, 'textarea', sla, '20.3'),
  variable('sla.compensation', 'Compensation ou remède', 4, 'textarea', sla, '20.4'),
  variable('sla.fuseau', 'Fuseau horaire du mois civil de mesure', 4, 'text', sla),
  variable('support.fuseau', 'Fuseau horaire du support', 4, 'text', support),
  variable('support.horaires', 'Jours et horaires de support', 4, 'textarea', support, '19.2'),
  variable('support.canaux', 'Canaux et contact de support', 4, 'textarea', support, '6.0'),
  variable('support.accuse', 'Délai d’accusé de réception', 4, 'text', support),
  variable('support.p1', 'Prise en charge P1 — service indisponible', 4, 'text', support),
  variable('support.p2', 'Prise en charge P2 — service dégradé', 4, 'text', support),
  variable('support.p3', 'Prise en charge P3 — demande mineure', 4, 'text', support),
  variable('support.resolution', 'Objectif ou modalités de résolution (distinct de la prise en charge)', 4, 'textarea', support, '21.4'),
  variable('supervision.conditions', 'Outils, fréquence et périmètre de supervision', 4, 'textarea', config => hasService(config, 'SUPERVISION')),
  variable('maintenance.fenetre', 'Fenêtre de maintenance et préavis', 5, 'textarea', maintenance, '21.0'),
  variable('securite.correctifs', 'Procédure et délai cible des correctifs critiques', 5, 'textarea', security, '22.1'),
  variable('securite.client', 'Responsabilités du client', 5, 'textarea', security, '22.2'),
  variable('backups.autre', 'Autres données sauvegardées', 6, 'textarea', config => backups(config) && selected(config, 'backups.donnees').includes('AUTRE')),
  variable('backups.exclusions', 'Données exclues des sauvegardes', 6, 'textarea', backups, '23.1'),
  variable('backups.frequence', 'Fréquence des sauvegardes', 6, 'text', backups, '23.2'),
  variable('backups.retentions', 'Politique complète de rétention : durées et nombre de versions', 6, 'textarea', backups, '23.4'),
  variable('backups.localisation', 'Destination, fournisseur et région des sauvegardes', 6, 'textarea', backups, '23.5'),
  variable('backups.controle', 'Contrôles d’exécution et alertes', 6, 'textarea', backups, '23.7'),
  variable('backups.test_restauration', 'Fréquence et modalités des tests de restauration', 6, 'textarea', backups, '23.8'),
  variable('backups.echec', 'Information du client et mesures en cas d’échec', 6, 'textarea', backups),
  variable('backups.expiration', 'Délai de suppression des versions expirées', 6, 'text', backups),
  variable('backups.rpo', 'Valeur RPO garantie', 6, 'text', guaranteed('backups.rpo.mode')),
  variable('backups.rto', 'Valeur RTO garantie', 6, 'text', guaranteed('backups.rto.mode')),
  variable('backups.restauration_conditions', 'Coût et délai d’une restauration demandée', 6, 'textarea', backups, '23.11'),
  variable('restauration.conditions', 'Périmètre, prix et délai de la prestation de restauration', 6, 'textarea', config => hasService(config, 'RESTAURATION')),
  variable('contrat.duree', 'Durée des services récurrents', 7, 'text', config => choice(config, 'contrat.duree.mode') === 'DUREE_DETERMINEE', '12.0'),
  variable('contrat.debut', 'Date de début des services récurrents', 7, 'text', recurring, '12.1'),
  variable('contrat.preavis', 'Préavis et canal de résiliation', 7, 'textarea', recurring, '12.3'),
  variable('contrat.regularisation', 'Délai de régularisation après mise en demeure (jours)', 7, 'number', undefined, '12.4'),
  variable('reversibilite.format', 'Format et contenu des exports', 7, 'textarea', undefined, '12.5'),
  variable('reversibilite.delai', 'Délai de demande d’export après fin (jours)', 7, 'number', undefined, '12.7'),
  variable('reversibilite.effacement', 'Délai d’effacement des données opérationnelles', 7, 'text', undefined, '24.2'),
  variable('reversibilite.sauvegardes', 'Délai maximal de suppression des sauvegardes résiduelles', 7, 'textarea', backups, '24.3'),
  variable('reversibilite.assistance', 'Conditions et coût de l’assistance à la migration', 7, 'textarea', config => choice(config, 'reversibilite.mode') !== 'EXPORT_SIMPLE' && !!choice(config, 'reversibilite.mode'), '24.4'),
  variable('confidentialite.duree', 'Durée de confidentialité après fin (années)', 7, 'number', undefined, '9.0'),
  variable('rgpd.responsable', 'Responsable de traitement', 7, 'text', dataProcessing, '26.0'),
  variable('rgpd.sous_traitant', 'Sous-traitant', 7, 'text', dataProcessing, '26.1'),
  variable('rgpd.finalites', 'Objet, nature et finalités des traitements', 7, 'textarea', dataProcessing, '26.2'),
  variable('rgpd.duree', 'Durée des traitements', 7, 'text', dataProcessing, '26.3'),
  variable('rgpd.personnes', 'Catégories de personnes concernées', 7, 'textarea', dataProcessing, '26.4'),
  variable('rgpd.donnees', 'Types de données personnelles', 7, 'textarea', dataProcessing, '26.5'),
  variable('rgpd.instructions', 'Instructions documentées', 7, 'textarea', dataProcessing, '26.6'),
  variable('rgpd.sous_traitants', 'Sous-traitants ultérieurs, autorisations, information et opposition', 7, 'textarea', dataProcessing),
  variable('rgpd.securite', 'Confidentialité des personnes habilitées et mesures de sécurité', 7, 'textarea', dataProcessing),
  variable('rgpd.assistance', 'Assistance : droits des personnes, analyses d’impact et notifications', 7, 'textarea', dataProcessing),
  variable('rgpd.violations', 'Information des violations et modalités de notification', 7, 'textarea', dataProcessing),
  variable('rgpd.audits', 'Audits et mise à disposition des informations', 7, 'textarea', dataProcessing),
  variable('rgpd.fin', 'Restitution ou suppression en fin de mission', 7, 'textarea', dataProcessing),
  variable('rgpd.transferts', 'Transferts internationaux et mécanismes applicables', 7, 'textarea', dataProcessing),
  variable('assurance', 'Assureur, police et couverture (ou absence d’assurance)', 8, 'textarea', undefined, '13.0'),
  variable('reclamations', 'E-mail et adresse postale pour les réclamations', 8, 'textarea', undefined, '15.0'),
  variable('mediateur', 'Médiateur de la consommation et coordonnées', 8, 'textarea', consumer, '15.1'),
  variable('signature.ville', 'Ville de signature', 8, 'text', undefined, '16.0'),
  variable('signature.exemplaires', 'Nombre d’exemplaires', 8, 'number', undefined, '16.2')
]

export const contractConfirmations = [
  { key: 'identite', label: 'Identité des parties vérifiée' },
  { key: 'devis', label: 'Devis, prestations et périmètre vérifiés' },
  { key: 'prix', label: 'Prix et durée vérifiés' },
  { key: 'coherence', label: 'Options, engagements et annexes cohérents avec le devis' },
  { key: 'consommateur', label: 'Informations, rétractation, médiation, renouvellement et résiliation du consommateur vérifiés', when: consumer },
  { key: 'cession', label: 'Annexe de cession détaillée et validation juridique effectuées', when: assignment },
  { key: 'rgpd', label: 'Annexe de sous-traitance complétée et vérifiée avant traitement', when: dataProcessing }
]

export function defaultConfiguration(): ContractConfiguration {
  return {
    choices: Object.fromEntries(contractChoices.filter(field => !field.multiple).map(field => [field.key, field.default ?? ''])),
    selections: Object.fromEntries(contractChoices.filter(field => field.multiple).map(field => [field.key, []])),
    confirmations: Object.fromEntries(contractConfirmations.map(field => [field.key, false]))
  }
}

export function optionLabel(config: ContractConfiguration, key: string) {
  const field = contractChoices.find(field => field.key === key)!
  return field.multiple
    ? selected(config, key).map(value => field.options.find(option => option.value === value)?.label ?? '').filter(Boolean).join(', ')
    : field.options.find(option => option.value === choice(config, key))?.label ?? ''
}

export function activeContractVariables(config: ContractConfiguration) {
  return contractVariables.filter(field => !field.when || field.when(config))
}
