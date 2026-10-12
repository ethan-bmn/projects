import type { Client } from './clients'

export const projectSections = [
  { key: 'businessContext', label: 'Contexte métier', optional: true },
  { key: 'technicalContext', label: 'Contexte technique', optional: true },
  { key: 'objectives', label: 'Objectifs', optional: false },
  { key: 'stakes', label: 'Enjeux', optional: false },
  { key: 'businessConstraints', label: 'Contraintes métiers', optional: false },
  { key: 'technicalConstraints', label: 'Contraintes techniques', optional: true },
  { key: 'softwareArchitecture', label: 'Architecture logicielle', optional: false },
  { key: 'databaseArchitecture', label: 'Architecture DB', optional: true },
  { key: 'toolsAndFrameworks', label: 'Outils et frameworks', optional: false },
  { key: 'schedule', label: 'Planning', optional: true }
] as const

export type ProjectSection = typeof projectSections[number]['key']
type OptionalProjectSection = Extract<typeof projectSections[number], { optional: true }>['key']
export type ProjectSpecification = Record<Exclude<ProjectSection, OptionalProjectSection>, string>
  & Record<OptionalProjectSection, string | null>

export interface ProjectInput {
  name: string
  specification: ProjectSpecification
}

export interface ProjectSummary {
  id: string
  clientId: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Project extends ProjectSummary {
  specification: ProjectSpecification
}

export interface ClientProjects {
  client: Client & { active: boolean }
  projects: ProjectSummary[]
}

export interface ProjectDetail {
  client: Client & { active: boolean }
  project: Project
}
