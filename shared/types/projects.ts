import type { Client } from './clients'
import type { ProjectDiagrams } from './diagrams'
import type { ProjectContract } from './contracts'
import type { ProviderProfile } from './provider'

export const projectSections = [
  { key: 'businessContext', label: 'Contexte métier', optional: true },
  { key: 'technicalContext', label: 'Contexte technique', optional: true },
  { key: 'objectives', label: 'Objectifs', optional: false },
  { key: 'stakes', label: 'Enjeux', optional: false },
  { key: 'projectScope', label: 'Périmètre du projet', optional: true },
  { key: 'stakeholders', label: 'Parties prenantes', optional: true },
  { key: 'functionalRequirements', label: 'Besoins fonctionnels', optional: true },
  { key: 'nonFunctionalRequirements', label: 'Besoins non fonctionnels', optional: true },
  { key: 'businessConstraints', label: 'Contraintes métiers', optional: false },
  { key: 'technicalConstraints', label: 'Contraintes techniques', optional: true },
  { key: 'softwareArchitecture', label: 'Architecture logicielle', optional: false },
  { key: 'databaseArchitecture', label: 'Architecture DB', optional: true },
  { key: 'dataManagement', label: 'Gestion des données', optional: true },
  { key: 'toolsAndFrameworks', label: 'Outils et frameworks', optional: false },
  { key: 'targetDomains', label: 'Nom de domaine(s) ciblé(s)', optional: true },
  { key: 'deliverables', label: 'Livrables attendus', optional: true },
  { key: 'acceptanceCriteria', label: 'Critères de recette', optional: true },
  { key: 'operationsAndMaintenance', label: 'Exploitation et maintenance', optional: true },
  { key: 'schedule', label: 'Planning', optional: true }
] as const

export type ProjectSection = typeof projectSections[number]['key']
type OptionalProjectSection = Extract<typeof projectSections[number], { optional: true }>['key']
export type ProjectSpecification = Record<Exclude<ProjectSection, OptionalProjectSection>, string>
  & Record<OptionalProjectSection, string | null>

export interface ProjectInput {
  name: string
  specification: ProjectSpecification
  diagrams?: ProjectDiagrams
  contract?: ProjectContract | null
}

export interface ProjectSummary {
  id: string
  clientId: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Project extends ProjectSummary {
  contract?: ProjectContract | null
  specification: ProjectSpecification
  diagrams?: ProjectDiagrams
}

export interface ClientProjects {
  client: Client & { active: boolean }
  projects: ProjectSummary[]
}

export interface ProjectDetail {
  client: Client & { active: boolean }
  provider?: ProviderProfile
  project: Project
}
