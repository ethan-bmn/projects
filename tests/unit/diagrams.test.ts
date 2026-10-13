import { describe, expect, it } from 'vitest'
import { databaseDrawing, parseChartDb, validateDiagrams, validateWbs, wbsRows } from '../../shared/utils/diagrams'
import { validateProjectInput } from '../../server/services/projects'
import { projectDiagrams } from '../helpers/diagrams'
import { projectInput } from '../helpers/projects'

describe('project diagrams', () => {
  it('accepts ChartDB JSON exports and preserves the full source for reopening', () => {
    const diagrams = projectDiagrams()
    expect(validateProjectInput({ ...projectInput(), diagrams }).diagrams).toEqual(diagrams)
    const drawing = databaseDrawing(diagrams.database!)
    expect(drawing.boxes).toHaveLength(2)
    expect(drawing.edges).toEqual([{ id: 'relation', from: 'projects', to: 'customers' }])
    expect(drawing.boxes[1]!.lines).toContain('client_id : uuid')
  })

  it('rejects malformed imports, invalid coordinates, duplicate IDs and dangling relationships', () => {
    expect(() => parseChartDb('not-json')).toThrow('JSON')
    expect(() => parseChartDb('[]')).toThrow()
    expect(() => parseChartDb('x'.repeat(500001))).toThrow('500 Ko')
    const parsed = JSON.parse(projectDiagrams().database!) as { tables: Record<string, unknown>[], relationships: Record<string, unknown>[] }
    const invalid = [
      { ...parsed, tables: [{ ...parsed.tables[0], x: '0' }, parsed.tables[1]] },
      { ...parsed, tables: [parsed.tables[0], { ...parsed.tables[1], id: parsed.tables[0]!.id }] },
      { ...parsed, relationships: [{ ...parsed.relationships[0], sourceFieldId: 'missing' }] }
    ]
    for (const value of invalid) {
      expect(() => parseChartDb(JSON.stringify(value))).toThrow()
    }
  })

  it('numbers the hierarchy in sibling order even when children are stored later', () => {
    const items = projectDiagrams().wbs
    expect(wbsRows([items[0]!, items[2]!, items[1]!]).map(row => [row.number, row.item.id, row.depth]))
      .toEqual([['1', 'design', 0], ['1.1', 'specification', 1], ['2', 'delivery', 0]])
  })

  it('rejects cyclic, orphaned, duplicate, blank and overly deep WBS tasks', () => {
    const task = { id: 'one', parentId: null, label: 'Tâche' }
    for (const items of [
      [{ ...task, parentId: 'one' }],
      [{ ...task, parentId: 'missing' }],
      [task, task],
      [{ ...task, label: ' ' }],
      Array.from({ length: 7 }, (_, index) => ({ id: String(index), parentId: index ? String(index - 1) : null, label: 'Tâche' })),
      Array.from({ length: 101 }, (_, index) => ({ ...task, id: String(index) }))
    ]) expect(() => validateWbs(items)).toThrow()
  })

  it('accepts clearing optional diagrams and rejects non-text database sources', () => {
    expect(validateDiagrams({ database: '', wbs: [] })).toEqual({ database: null, wbs: [] })
    expect(() => validateProjectInput({ ...projectInput(), diagrams: { database: {}, wbs: [] } })).toThrow('ChartDB')
  })
})
