import type { ProjectInput } from '../../shared/types/projects'

export function projectInput(name = 'Refonte du site'): ProjectInput {
  return {
    name,
    specification: {
      businessContext: 'Vente de produits artisanaux.',
      technicalContext: 'Le site actuel est statique.',
      objectives: 'Permettre les commandes en ligne.',
      stakes: 'Développer le chiffre d’affaires.',
      businessConstraints: 'Maintenir les ventes pendant la transition.',
      technicalConstraints: 'Hébergement européen.',
      softwareArchitecture: 'Application Nuxt avec API serveur.',
      databaseArchitecture: null,
      toolsAndFrameworks: 'Nuxt, Vue et PostgreSQL.',
      schedule: 'Semaine 1 : conception.\nSemaines 2 à 4 : développement.'
    }
  }
}
