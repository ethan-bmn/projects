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
  hidden?: boolean
}
export interface ContractVariable {
  key: string
  label: string
  group: number
  type: 'text' | 'textarea' | 'date' | 'number'
  when?: Condition
  legacy?: string
  optional?: boolean
  hidden?: boolean
}

export const contractGroups = [
  'Identité des parties et cadre juridique', 'Prestations souscrites',
  'Développement et propriété intellectuelle', 'Hébergement et facturation',
  'Disponibilité et support', 'Maintenance et sécurité', 'Sauvegardes',
  'Durée, réversibilité et données personnelles', 'Vérifications avant export'
]

export const clientCodeOwnershipClause = 'Tout le code produit dans le cadre du présent contrat est la propriété du Client. Le Client peut demander à tout moment la remise du code source, que le Prestataire s’engage à lui fournir.'

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
export const processingRole = (config: ContractConfiguration) => choice(config, 'processing_role') !== 'undetermined'
  ? choice(config, 'processing_role')
  : choice(config, 'rgpd.sous_traitance') === 'OUI' ? 'processor' : choice(config, 'rgpd.sous_traitance') === 'NON' ? 'not_processor' : 'undetermined'
export const dataProcessing: Condition = config => processingRole(config) === 'processor'
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
  single('client.entity_type', 'Nature juridique du client', 0, [['natural_person', 'Personne physique'], ['legal_entity', 'Personne morale']]),
  single('client.qualite', 'Qualité du client', 0, [['individual', 'Particulier'], ['sole_proprietor', 'Entrepreneur individuel (EI)']], config => choice(config, 'client.entity_type') === 'natural_person'),
  single('client.contracting_capacity', 'Capacité de contracter', 0, [['consumer', 'Consommateur'], ['professional', 'Professionnel'], ['undetermined', 'À qualifier — export bloqué']], undefined, 'undetermined'),
  single('processing_role', 'Rôle au regard des données personnelles', 0, [['processor', 'Sous-traitant — accord obligatoire'], ['not_processor', 'Pas de traitement pour le compte du client'], ['undetermined', 'À qualifier — export bloqué']], undefined, 'undetermined'),
  single('rgpd.autorisation_sous_traitants', 'Autorisation des sous-traitants ultérieurs', 7, [['general', 'Autorisation générale'], ['specific', 'Autorisation spécifique']], config => choice(config, 'processing_role') === 'processor'),
  single('rgpd.transfert', 'Transfert hors EEE', 7, [['oui', 'Oui'], ['non', 'Non']], config => dataProcessing(config), 'non'),
  single('client.type', 'Type de client', 0, [['PRO_ENTREPRISE', 'Entreprise'], ['PRO_INDEPENDANT', 'Professionnel indépendant'], ['CONSOMMATEUR', 'Particulier'], ['ASSOCIATION', 'Association'], ['AUTRE', 'Autre']]),
  multiple('services', 'Services commandés au devis', 1, [
    ['AUDIT', 'Audit'], ['CONCEPTION', 'Conception'], ['DEVELOPPEMENT', 'Développement'], ['DEPLOIEMENT', 'Déploiement'],
    ['HEBERGEMENT', 'Hébergement'], ['MAINTENANCE_CORRECTIVE', 'Maintenance corrective'], ['MAINTENANCE_EVOLUTIVE', 'Maintenance évolutive'],
    ['SECURITE', 'Sécurité'], ['SUPERVISION', 'Supervision'], ['SAUVEGARDES', 'Sauvegardes'], ['RESTAURATION', 'Restauration'],
    ['DNS', 'DNS'], ['NOM_DE_DOMAINE', 'Nom de domaine'], ['SUPPORT', 'Support'], ['SUPPORT_PRIORITAIRE', 'Support prioritaire'], ['DONNEES_SENSIBLES', 'Données sensibles'], ['REVERSIBILITE_ASSISTEE', 'Réversibilité assistée']
  ]),
  single('developpement.mode', 'Mode de réalisation', 2, [['FORFAIT', 'Forfait'], ['REGIE', 'Régie'], ['MIXTE', 'Mixte']], development),
  single('recette.active', 'Procédure de recette', 2, yesNo, development),
  single('garantie.active', 'Maintenance corrective incluse après livraison', 2, yesNo, development),
  single('hebergement.mode', 'Offre d’hébergement', 3, [['NON_INCLUS', 'Non inclus'], ['PAYANT_RECURRENT', 'Payant récurrent'], ['OFFERT_DUREE_DEFINIE', 'Offert pour une durée définie'], ['INCLUS_DANS_FORFAIT', 'Inclus dans le forfait']], hosting, 'NON_INCLUS'),
  single('hebergement.periodicite', 'Périodicité de facturation', 3, [['MENSUELLE', 'Mensuelle'], ['ANNUELLE', 'Annuelle'], ['AUTRE', 'Autre']], config => hosting(config) && choice(config, 'hebergement.mode') === 'PAYANT_RECURRENT'),
  single('hebergement.infrastructure', 'Infrastructure', 3, [['VPS_MUTUALISE', 'VPS mutualisé'], ['VPS_DEDIE_CLIENT', 'VPS dédié au client'], ['AUTRE', 'Autre']], hosting),
  single('sla.mode', 'Engagement de disponibilité', 4, [['AUCUN_ENGAGEMENT_CHIFFRE', 'SANS SLA — aucun engagement chiffré'], ['SLA_CHIFFRE', 'SLA CHIFFRÉ — engagement chiffré']], hosting, 'AUCUN_ENGAGEMENT_CHIFFRE'),
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
  variable('client.prenom', 'Prénom du client', 0, 'text', config => choice(config, 'client.entity_type') === 'natural_person'),
  variable('client.nom_famille', 'Nom de famille du client', 0, 'text', config => choice(config, 'client.entity_type') === 'natural_person'),
  variable('client.nom', 'Nom complet du client', 0, 'text', undefined, '0.0'),
  variable('client.adresse', 'Adresse du client', 0, 'textarea', undefined, '0.2'),
  variable('client.email', 'E-mail du client', 0, 'text', undefined, '0.4'),
  variable('client.fonction_representant', 'Qualité du représentant autorisé', 0, 'text', config => choice(config, 'client.entity_type') === 'legal_entity'),
  variable('client.immatriculation', 'Phrase complète d’immatriculation', 0, 'textarea', config => choice(config, 'client.entity_type') === 'legal_entity', undefined, true),
  variable('client.siren', 'SIREN du client', 0, 'text', config => choice(config, 'client.entity_type') === 'legal_entity' || choice(config, 'client.qualite') === 'sole_proprietor' || professional(config)),
  variable('client.forme', 'Forme juridique', 0, 'text', config => ['PRO_ENTREPRISE', 'ASSOCIATION', 'AUTRE'].includes(choice(config, 'client.type')), '0.1'),
  variable('client.representant', 'Nom du représentant autorisé', 0, 'text', config => choice(config, 'client.entity_type') === 'legal_entity' || ['PRO_ENTREPRISE', 'ASSOCIATION', 'AUTRE'].includes(choice(config, 'client.type')), '0.3'),
  variable('client.autre', 'Préciser le statut du client', 0, 'text', config => choice(config, 'client.type') === 'AUTRE'),
  variable('contrat.reference', 'Référence du contrat', 0, 'text'),
  variable('contrat.date', 'Date du contrat', 0, 'date', undefined, '16.1'),
  variable('devis.reference', 'Référence du devis', 0, 'text', undefined, '1.0'),
  variable('devis.date', 'Date d’émission du devis', 0, 'text', undefined, '1.1'),
  variable('consommateur.informations', 'Informations précontractuelles et droit de rétractation applicables', 0, 'textarea', consumer),
  variable('perimetre', 'Périmètre et livrables convenus au devis', 1),
  variable('domaine.conditions', 'Titulaire, gestionnaire, payeur, renouvellement, transfert et remise des accès', 1, 'textarea', config => hasService(config, 'DNS', 'NOM_DE_DOMAINE')),
  variable('recette.delai', 'Délai de recette en jours ouvrés', 2, 'number', config => development(config) && choice(config, 'recette.active') === 'OUI', '3.0'),
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
  variable('rgpd.prestations', 'Prestations concernées par le traitement', 7, 'textarea', dataProcessing),
  variable('rgpd.personnes_concernees', 'Catégories de personnes concernées', 7, 'textarea', dataProcessing),
  variable('rgpd.categories_donnees', 'Catégories de données personnelles', 7, 'textarea', dataProcessing),
  variable('rgpd.date_debut', 'Date de début des traitements', 7, 'date', dataProcessing),
  variable('rgpd.operations', 'Nature des opérations', 7, 'textarea', dataProcessing),
  variable('rgpd.donnees_sensibles', 'Données sensibles concernées', 7, 'textarea', config => dataProcessing(config) && hasService(config, 'DONNEES_SENSIBLES'), undefined, true),
  variable('rgpd.localisations', 'Localisation des traitements', 7, 'textarea', dataProcessing),
  variable('rgpd.pays_tiers', 'Pays hors EEE concernés', 7, 'textarea', config => dataProcessing(config) && choice(config, 'rgpd.transfert') === 'oui'),
  variable('rgpd.garanties_transfert', 'Garanties de transfert applicables', 7, 'textarea', config => dataProcessing(config) && choice(config, 'rgpd.transfert') === 'oui'),
  variable('rgpd.contact_client', 'Contact du Responsable du traitement', 7, 'text', dataProcessing),
  variable('rgpd.contact_incident_client', 'Contact incident côté client', 7, 'text', dataProcessing),
  variable('rgpd.contact_incident_prestataire', 'Contact incident côté prestataire', 7, 'text', dataProcessing),
  variable('rgpd.canal_notification', 'Canal de notification des violations', 7, 'text', dataProcessing),
  variable('rgpd.delai_notification', 'Délai cible de notification', 7, 'text', dataProcessing),
  variable('rgpd.sort_des_donnees', 'Sort des données en fin de prestation', 7, 'textarea', dataProcessing),
  variable('rgpd.modalites_fin', 'Modalités de restitution ou suppression', 7, 'textarea', dataProcessing),
  variable('rgpd.delai_suppression', 'Délai de suppression des données actives', 7, 'text', dataProcessing),
  variable('rgpd.purge_sauvegardes', 'Purge des copies de sauvegarde', 7, 'text', dataProcessing),
  variable('rgpd.conservation_legale', 'Obligations particulières de conservation', 7, 'textarea', dataProcessing),
  variable('rgpd.sous_traitants_ulterieurs', 'Liste des sous-traitants ultérieurs', 7, 'textarea', dataProcessing),
  variable('rgpd.destinataires_transfert', 'Destinataires des transferts', 7, 'textarea', config => dataProcessing(config) && choice(config, 'rgpd.transfert') === 'oui'),
  variable('rgpd.finalites_transfert', 'Finalités des transferts', 7, 'textarea', config => dataProcessing(config) && choice(config, 'rgpd.transfert') === 'oui'),
  variable('rgpd.mesures_complementaires', 'Mesures complémentaires de transfert', 7, 'textarea', config => dataProcessing(config) && choice(config, 'rgpd.transfert') === 'oui'),
  variable('assurance', 'Assureur, police et couverture (ou absence d’assurance)', 8, 'textarea', undefined, '13.0'),
  variable('reclamations', 'E-mail et adresse postale pour les réclamations', 8, 'textarea', undefined, '15.0'),
  variable('mediateur', 'Médiateur de la consommation et coordonnées', 8, 'textarea', consumer, '15.1'),
  variable('signature.ville', 'Ville de signature', 8, 'text', undefined, '16.0'),
  variable('signature.exemplaires', 'Nombre d’exemplaires', 8, 'number', undefined, '16.2')
]

const templateVariableLabels: Record<string, string> = {
  'annexe.date': 'Date de l’annexe',
  'annexe.reference': 'Référence de l’annexe',
  'annexe.version': 'Version de l’annexe',
  'client.forme_juridique': 'Forme juridique du client',
  'client.signataire': 'Signataire client',
  'contrat.date_debut': 'Date de début du contrat',
  'contrat.date_signature': 'Date de signature',
  'contrat.lieu_signature': 'Lieu de signature',
  'devis.date_acceptation': 'Date d’acceptation du devis',
  'domaine.facturation': 'Facturation du nom de domaine',
  'domaine.nom': 'Nom de domaine',
  'domaine.titulaire': 'Titulaire du nom de domaine',
  'facturation.delai_paiement': 'Délai de paiement',
  'facturation.taux_penalites': 'Taux des pénalités de retard',
  'hebergement.date_debut': 'Date de début de l’hébergement',
  'hebergement.domaine': 'Domaine hébergé',
  'hebergement.duree_offerte': 'Durée de la période offerte',
  'hebergement.environnement_technique': 'Environnement technique',
  'hebergement.fournisseur': 'Fournisseur d’hébergement',
  'hebergement.localisation': 'Localisation de l’hébergement',
  'hebergement.periodicite': 'Périodicité de facturation',
  'hebergement.ressources': 'Ressources allouées',
  'hebergement.sla': 'Taux de disponibilité garanti',
  'hebergement.type': 'Type d’hébergement',
  'maintenance.perimetre': 'Périmètre de la maintenance applicative',
  'maintenance.preavis': 'Préavis de maintenance',
  'prestataire.adresse': 'Adresse du prestataire',
  'prestataire.email': 'E-mail du prestataire',
  'prestataire.nom': 'Nom du prestataire',
  'prestataire.siren': 'SIREN du prestataire',
  'prestation.delai_validation': 'Délai de validation de la prestation',
  'rgpd.acces': 'Gestion des accès',
  'rgpd.assistance_droits': 'Assistance aux droits des personnes',
  'rgpd.controles_securite': 'Contrôles de sécurité',
  'rgpd.durees_conservation': 'Durées de conservation',
  'rgpd.preavis_sous_traitants': 'Préavis de changement de sous-traitant',
  'rgpd.protections': 'Protection des données dès la conception',
  'sauvegardes.controles': 'Contrôles des sauvegardes',
  'sauvegardes.engagements_reprise': 'Engagements de reprise',
  'sauvegardes.modalites_restauration': 'Modalités de restauration',
  'sauvegardes.protection': 'Protection des sauvegardes',
  'sauvegardes.retention': 'Durée de rétention',
  'sauvegardes.rotation': 'Politique de rotation',
  'sauvegardes.tests': 'Tests de restauration',
  'securite.mesures': 'Mesures de sécurité',
  'service.date_debut': 'Date de mise en service',
  'service.environnement': 'Environnement hébergé',
  'service.nom': 'Nom du service',
  'service.url': 'Adresse du service',
  'sla.compensation': 'Compensation ou remède du SLA',
  'sla.critere': 'Critère d’indisponibilité',
  'sla.frequence': 'Fréquence des contrôles du SLA',
  'sla.methode': 'Méthode de supervision du SLA',
  'sla.taux': 'Taux de disponibilité',
  'supervision.alertes': 'Système d’alerte',
  'supervision.frequence': 'Fréquence de supervision',
  'supervision.methode': 'Méthode de supervision',
  'supervision.perimetre': 'Périmètre de supervision',
  'support.canal': 'Canal de support',
  'support.contact': 'Contact de support',
  'support.delais': 'Délais de support prioritaires',
  'support.horaires': 'Horaires de support'
}

const templateVariableConditions: Partial<Record<string, Condition>> = {
  'annexe.date': dataProcessing,
  'annexe.reference': dataProcessing,
  'annexe.version': dataProcessing,
  'client.forme_juridique': config => choice(config, 'client.entity_type') === 'legal_entity',
  'client.signataire': config => choice(config, 'client.entity_type') === 'legal_entity',
  'contrat.date_debut': recurring,
  'contrat.date_signature': undefined,
  'devis.date_acceptation': undefined,
  'domaine.facturation': config => hasService(config, 'NOM_DE_DOMAINE'),
  'domaine.nom': config => hasService(config, 'NOM_DE_DOMAINE'),
  'domaine.titulaire': config => hasService(config, 'NOM_DE_DOMAINE'),
  'facturation.delai_paiement': undefined,
  'facturation.taux_penalites': undefined,
  'hebergement.date_debut': hosting,
  'hebergement.domaine': hosting,
  'hebergement.duree_offerte': config => hosting(config) && choice(config, 'hebergement.mode') === 'OFFERT_DUREE_DEFINIE',
  'hebergement.environnement_technique': hosting,
  'hebergement.fournisseur': hosting,
  'hebergement.localisation': hosting,
  'hebergement.periodicite': hosting,
  'hebergement.ressources': hosting,
  'hebergement.sla': sla,
  'hebergement.type': hosting,
  'maintenance.perimetre': config => hasService(config, 'MAINTENANCE_CORRECTIVE', 'MAINTENANCE_EVOLUTIVE'),
  'maintenance.preavis': config => hasService(config, 'MAINTENANCE_CORRECTIVE', 'MAINTENANCE_EVOLUTIVE'),
  'prestation.delai_validation': development,
  'rgpd.acces': dataProcessing,
  'rgpd.assistance_droits': dataProcessing,
  'rgpd.controles_securite': dataProcessing,
  'rgpd.durees_conservation': dataProcessing,
  'rgpd.preavis_sous_traitants': config => dataProcessing(config) && choice(config, 'rgpd.autorisation_sous_traitants') === 'general',
  'rgpd.protections': dataProcessing,
  'sauvegardes.controles': backups,
  'sauvegardes.engagements_reprise': config => backups(config) && (choice(config, 'backups.rpo.mode') === 'GARANTI' || choice(config, 'backups.rto.mode') === 'GARANTI'),
  'sauvegardes.modalites_restauration': backups,
  'sauvegardes.protection': backups,
  'sauvegardes.retention': backups,
  'sauvegardes.rotation': backups,
  'sauvegardes.tests': backups,
  'securite.mesures': config => hasService(config, 'SECURITE'),
  'service.date_debut': hosting,
  'service.environnement': hosting,
  'service.nom': hosting,
  'service.url': hosting,
  'sla.compensation': sla,
  'sla.critere': sla,
  'sla.frequence': sla,
  'sla.methode': sla,
  'sla.taux': sla,
  'supervision.alertes': config => hasService(config, 'SUPERVISION'),
  'supervision.frequence': config => hasService(config, 'SUPERVISION'),
  'supervision.methode': config => hasService(config, 'SUPERVISION'),
  'supervision.perimetre': config => hasService(config, 'SUPERVISION'),
  'support.canal': support,
  'support.contact': support,
  'support.delais': config => support(config) && selected(config, 'services').includes('SUPPORT_PRIORITAIRE'),
  'support.horaires': support
}

for (const [key, label] of Object.entries(templateVariableLabels)) {
  if (contractVariables.some(variable => variable.key === key)) continue
  contractVariables.push(variable(key, label, key.startsWith('rgpd.') ? 7 : key.startsWith('sauvegardes.') ? 6 : key.startsWith('support.') || key.startsWith('sla.') || key.startsWith('supervision.') ? 4 : 1, 'textarea', templateVariableConditions[key]))
}

for (const key of ['client.type', 'rgpd.sous_traitance']) contractChoices.find(field => field.key === key)!.hidden = true
for (const key of ['client.forme']) contractVariables.find(field => field.key === key)!.hidden = true
for (const key of ['client.prenom', 'client.nom_famille']) contractVariables.find(field => field.key === key)!.hidden = true
for (const key of ['prestataire.nom', 'prestataire.siren', 'prestataire.adresse', 'prestataire.email']) contractVariables.find(field => field.key === key)!.hidden = true
// Keep saved signature values compatible, but collect them when the documents are signed.
for (const key of ['signature.ville', 'signature.exemplaires', 'client.signataire', 'contrat.date_signature', 'contrat.lieu_signature']) contractVariables.find(field => field.key === key)!.hidden = true
for (const key of ['annexe.reference', 'annexe.version']) contractVariables.find(field => field.key === key)!.hidden = true

export const contractConfirmations = [
  { key: 'identite', label: 'Identité des parties vérifiée' },
  { key: 'devis', label: 'Devis, prestations et périmètre vérifiés' },
  { key: 'prix', label: 'Prix et durée vérifiés' },
  { key: 'coherence', label: 'Options, engagements et annexes cohérents avec le devis' },
  { key: 'consommateur', label: 'Informations, rétractation, médiation, renouvellement et résiliation du consommateur vérifiés', when: consumer },
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
  return contractVariables.filter(field => !field.hidden && (!field.when || field.when(config)))
}

export function contractVariableLabel(config: ContractConfiguration, field: Pick<ContractVariable, 'key' | 'label'>) {
  if (field.key === 'client.nom') return choice(config, 'client.entity_type') === 'legal_entity' ? 'Dénomination ou raison sociale' : 'Nom complet du client'
  return field.label
}
