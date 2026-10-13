import type { DiagramDrawing, ProjectDiagrams, WbsItem } from '../types/diagrams'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Le diagramme est invalide.')
  return value as Record<string, unknown>
}

function text(value: unknown, maximum = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /\p{Cc}/u.test(value)) {
    throw new Error(`Chaque libellé doit contenir entre 1 et ${maximum} caractères.`)
  }
  return value.trim()
}

function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`Le diagramme est limité à ${maximum} éléments.`)
  return value
}

function unique(values: string[]) {
  if (new Set(values).size !== values.length) throw new Error('Les identifiants du diagramme doivent être uniques.')
}

export function parseChartDb(source: string) {
  if (source.length > 500000) throw new Error('Le fichier ChartDB est limité à 500 Ko.')
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error('Le fichier ChartDB doit être un JSON valide.')
  }
  const diagram = object(value)
  const tables = list(diagram.tables, 50).map((value) => {
    const table = object(value)
    const fields = list(table.fields, 60).map((value) => {
      const field = object(value)
      return { id: text(field.id, 80), name: text(field.name), type: text(object(field.type).name), primaryKey: field.primaryKey === true }
    })
    unique(fields.map(field => field.id))
    for (const position of [table.x, table.y]) {
      if (typeof position !== 'number' || !Number.isFinite(position) || Math.abs(position) > 50000) throw new Error('La position d’une table est invalide.')
    }
    return { id: text(table.id, 80), name: text(table.name), x: table.x as number, y: table.y as number, fields }
  })
  if (!tables.length) throw new Error('Le fichier ChartDB doit contenir au moins une table.')
  unique(tables.map(table => table.id))
  const relationships = list(diagram.relationships ?? [], 200).map((value) => {
    const relationship = object(value)
    const sourceTable = tables.find(table => table.id === relationship.sourceTableId)
    const targetTable = tables.find(table => table.id === relationship.targetTableId)
    if (!sourceTable?.fields.some(field => field.id === relationship.sourceFieldId)
      || !targetTable?.fields.some(field => field.id === relationship.targetFieldId)) {
      throw new Error('Une relation ChartDB référence une table ou un champ introuvable.')
    }
    return { id: text(relationship.id, 80), from: sourceTable.id, to: targetTable.id }
  })
  unique(relationships.map(relationship => relationship.id))
  return { tables, relationships }
}

export function validateWbs(value: unknown): WbsItem[] {
  const items = list(value, 100).map((value) => {
    const item = object(value)
    return { id: text(item.id, 80), parentId: item.parentId === null ? null : text(item.parentId, 80), label: text(item.label) }
  })
  unique(items.map(item => item.id))
  const byId = new Map(items.map(item => [item.id, item]))
  for (const item of items) {
    const visited = new Set([item.id])
    let parentId = item.parentId
    while (parentId !== null) {
      const parent = byId.get(parentId)
      if (!parent || visited.has(parentId)) throw new Error('La hiérarchie WBS contient une référence invalide ou un cycle.')
      visited.add(parentId)
      if (visited.size > 6) throw new Error('La hiérarchie WBS est limitée à 6 niveaux.')
      parentId = parent.parentId
    }
  }
  return items
}

export function validateDiagrams(value: unknown): ProjectDiagrams {
  const input = object(value)
  if (input.database != null && typeof input.database !== 'string') throw new Error('Le diagramme ChartDB est invalide.')
  const database = typeof input.database === 'string' && input.database.trim() ? input.database : null
  if (database) parseChartDb(database)
  return { database, wbs: validateWbs(input.wbs ?? []) }
}

export function wbsRows(items: WbsItem[]) {
  const rows: { item: WbsItem, depth: number, number: string }[] = []
  function visit(parentId: string | null, depth: number, prefix: string) {
    items.filter(item => item.parentId === parentId).forEach((item, index) => {
      const number = `${prefix}${index + 1}`
      rows.push({ item, depth, number })
      visit(item.id, depth + 1, `${number}.`)
    })
  }
  visit(null, 0, '')
  return rows
}

export function diagramLines(value: string, maximum = 36) {
  const characters = Array.from(value)
  const lines: string[] = []
  for (let offset = 0; offset < characters.length; offset += maximum) lines.push(characters.slice(offset, offset + maximum).join(''))
  return lines.length ? lines : ['']
}

export function databaseDrawing(source: string): DiagramDrawing {
  const diagram = parseChartDb(source)
  const minX = Math.min(...diagram.tables.map(table => table.x))
  const minY = Math.min(...diagram.tables.map(table => table.y))
  const boxes = diagram.tables.map((table) => {
    const lines = [...diagramLines(table.name), ...table.fields.flatMap(field => diagramLines(`${field.primaryKey ? 'PK ' : ''}${field.name} : ${field.type}`))]
    return { id: table.id, x: table.x - minX + 20, y: table.y - minY + 20, width: 300, height: 20 + lines.length * 20, lines }
  })
  return {
    boxes, edges: diagram.relationships,
    width: Math.max(...boxes.map(box => box.x + box.width)) + 20,
    height: Math.max(...boxes.map(box => box.y + box.height)) + 20
  }
}

export function wbsDrawing(items: WbsItem[]): DiagramDrawing {
  let y = 20
  const boxes = wbsRows(items).map(({ item, depth, number }) => {
    const lines = diagramLines(`${number}. ${item.label}`)
    const box = { id: item.id, x: 20 + depth * 40, y, width: 300, height: 20 + lines.length * 20, lines }
    y += box.height + 20
    return box
  })
  return {
    boxes, edges: items.filter(item => item.parentId !== null).map(item => ({ id: item.id, from: item.parentId!, to: item.id })),
    width: Math.max(340, ...boxes.map(box => box.x + box.width + 20)), height: y
  }
}
