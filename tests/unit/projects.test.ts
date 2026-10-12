import { describe, expect, it } from 'vitest'
import { validateProjectInput } from '../../server/services/projects'
import { projectInput } from '../helpers/projects'

describe('project input validation', () => {
  it('accepts the specification with optional DB architecture and preserves multiline text', () => {
    const input = projectInput('  Refonte du site  ')
    const result = validateProjectInput(input)
    expect(result.name).toBe('Refonte du site')
    expect(result.specification.schedule).toContain('\n')
    expect(result.specification.databaseArchitecture).toBeNull()
    expect(input.name).toBe('  Refonte du site  ')
  })

  it.each([undefined, null, '', '   '])('allows missing or empty optional DB architecture: %s', (value) => {
    const input = projectInput()
    expect(validateProjectInput({ ...input, specification: { ...input.specification, databaseArchitecture: value } }).specification.databaseArchitecture).toBeNull()
  })

  it('preserves supplied DB architecture', () => {
    const input = projectInput()
    input.specification.databaseArchitecture = 'Tables clients, commandes et produits.'
    expect(validateProjectInput(input)).toEqual(input)
  })

  it.each(['businessContext', 'technicalContext', 'objectives', 'stakes', 'businessConstraints', 'technicalConstraints', 'softwareArchitecture', 'toolsAndFrameworks', 'schedule'])('requires section %s', (section) => {
    const input = projectInput()
    expect(() => validateProjectInput({ ...input, specification: { ...input.specification, [section]: ' ' } })).toThrow('champ')
  })

  it.each([null, [], {}, { name: 123 }, { name: ' ' }, { name: 'a'.repeat(201) }])('rejects invalid project names or bodies: %j', (input) => {
    expect(() => validateProjectInput(input)).toThrow()
  })

  it('rejects oversized sections and non-text contents', () => {
    const input = projectInput()
    for (const content of ['a'.repeat(20001), ['text'], { html: 'text' }, 42]) {
      expect(() => validateProjectInput({ ...input, specification: { ...input.specification, schedule: content } })).toThrow('Planning')
    }
  })
})
