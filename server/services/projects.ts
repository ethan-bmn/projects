import type postgres from 'postgres'
import type { Client } from '../../shared/types/clients'
import { projectSections } from '../../shared/types/projects'
import type { ClientProjects, Project, ProjectDetail, ProjectInput, ProjectSpecification, ProjectSummary } from '../../shared/types/projects'
import type { ProjectDiagrams } from '../../shared/types/diagrams'
import { validateDiagrams } from '../../shared/utils/diagrams'

export class ProjectError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message)
  }
}

export function validateProjectInput(value: unknown): ProjectInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProjectError('Le projet est invalide.')
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => !['name', 'specification', 'diagrams'].includes(key))) {
    throw new ProjectError('Le projet contient des champs non pris en charge.')
  }
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 200) {
    throw new ProjectError('Le nom du projet doit contenir entre 1 et 200 caractères.')
  }
  if (!input.specification || typeof input.specification !== 'object' || Array.isArray(input.specification)) {
    throw new ProjectError('Le cahier des charges est invalide.')
  }
  const source = input.specification as Record<string, unknown>
  const specification = {} as ProjectSpecification
  for (const section of projectSections) {
    const content = source[section.key]
    if (section.optional && (content == null || content === '')) {
      specification[section.key] = null
      continue
    }
    if (typeof content !== 'string' || (!section.optional && !content.trim()) || content.length > 20000) {
      throw new ProjectError(`Le champ « ${section.label} » doit contenir ${section.optional ? 'au maximum' : 'entre 1 et'} 20 000 caractères.`)
    }
    if (section.optional) specification[section.key] = content.trim() ? content : null
    else specification[section.key] = content
  }
  try {
    return {
      name: input.name.trim(), specification,
      ...(input.diagrams !== undefined ? { diagrams: validateDiagrams(input.diagrams) } : {})
    }
  } catch (error) {
    throw new ProjectError(error instanceof Error ? error.message : 'Les diagrammes sont invalides.')
  }
}

interface ProjectRow {
  id: string
  client_id: string
  name: string
  specification: ProjectSpecification
  diagrams: ProjectDiagrams
  created_at: Date
  updated_at: Date
}

function project(row: ProjectRow): Project {
  return {
    id: row.id, clientId: row.client_id, name: row.name,
    specification: Object.fromEntries(projectSections.map(section => [section.key, row.specification[section.key] ?? null])) as ProjectSpecification,
    diagrams: row.diagrams,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()
  }
}

async function client(sql: postgres.Sql, clientId: string): Promise<Client & { active: boolean }> {
  const [row] = await sql`
    SELECT id, abby_id, kind, name, emails, commercial_name, billing_address, active FROM clients WHERE id = ${clientId}
  `
  if (!row) throw new ProjectError('Client introuvable.', 404)
  return {
    id: row.id, abbyId: row.abby_id, kind: row.kind, name: row.name,
    emails: row.emails, commercialName: row.commercial_name, billingAddress: row.billing_address, active: row.active
  }
}

export async function getClientProjects(sql: postgres.Sql, clientId: string): Promise<ClientProjects> {
  const customer = await client(sql, clientId)
  const rows = await sql<ProjectRow[]>`
    SELECT id, client_id, name, created_at, updated_at FROM projects
    WHERE client_id = ${clientId} ORDER BY updated_at DESC, id
  `
  const projects: ProjectSummary[] = rows.map(row => ({
    id: row.id, clientId: row.client_id, name: row.name,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()
  }))
  return { client: customer, projects }
}

export async function createProject(sql: postgres.Sql, clientId: string, input: ProjectInput): Promise<Project> {
  const [row] = await sql<ProjectRow[]>`
    INSERT INTO projects (client_id, name, specification, diagrams)
    SELECT id, ${input.name}, ${sql.json(input.specification)}, ${sql.json(input.diagrams ?? { database: null, wbs: [] })} FROM clients WHERE id = ${clientId}
    RETURNING *
  `
  if (!row) throw new ProjectError('Client introuvable.', 404)
  return project(row)
}

export async function getProject(sql: postgres.Sql, clientId: string, projectId: string): Promise<ProjectDetail> {
  const customer = await client(sql, clientId)
  const [row] = await sql<ProjectRow[]>`SELECT * FROM projects WHERE id = ${projectId} AND client_id = ${clientId}`
  if (!row) throw new ProjectError('Projet introuvable pour ce client.', 404)
  return { client: customer, project: project(row) }
}

export async function updateProject(sql: postgres.Sql, clientId: string, projectId: string, input: ProjectInput): Promise<Project> {
  const [row] = await sql<ProjectRow[]>`
    UPDATE projects SET name = ${input.name}, specification = ${sql.json(input.specification)},
      diagrams = CASE WHEN ${input.diagrams !== undefined} THEN ${sql.json(input.diagrams ?? { database: null, wbs: [] })} ELSE diagrams END,
      updated_at = clock_timestamp()
    WHERE id = ${projectId} AND client_id = ${clientId} RETURNING *
  `
  if (!row) throw new ProjectError('Projet introuvable pour ce client.', 404)
  return project(row)
}
