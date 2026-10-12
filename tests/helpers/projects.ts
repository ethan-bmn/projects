import type { ProjectInput } from '../../shared/types/projects'

export function projectInput(name = 'Refonte du site'): ProjectInput {
  return {
    name,
    specification: {
      businessContext: 'Vente de produits artisanaux.',
      technicalContext: 'Le site actuel est statique.',
      objectives: 'Permettre les commandes en ligne.',
      stakes: 'Développer le chiffre d’affaires.',
      projectScope: 'Site marchand et espace client.',
      stakeholders: 'Client : Marie Durand. Prestataire : Ethan BAUMANN EI.',
      functionalRequirements: 'Catalogue, panier et suivi des commandes.',
      nonFunctionalRequirements: 'Interface accessible et adaptée aux mobiles.',
      businessConstraints: 'Maintenir les ventes pendant la transition.',
      technicalConstraints: 'Hébergement européen.',
      softwareArchitecture: 'Application Nuxt avec API serveur.',
      databaseArchitecture: null,
      dataManagement: 'Données clients conservées dans PostgreSQL.',
      toolsAndFrameworks: 'Nuxt, Vue et PostgreSQL.',
      targetDomains: 'boutique.example.test',
      deliverables: 'Code source, documentation et site déployé.',
      acceptanceCriteria: 'Commande de test validée de bout en bout.',
      operationsAndMaintenance: 'Sauvegarde quotidienne et mises à jour mensuelles.',
      schedule: 'Semaine 1 : conception.\nSemaines 2 à 4 : développement.'
    }
  }
}
