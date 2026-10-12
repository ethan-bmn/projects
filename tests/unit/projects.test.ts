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

  describe.each(['businessContext', 'technicalContext', 'technicalConstraints', 'databaseArchitecture', 'schedule'])('optional section %s', (section) => {
    it.each([undefined, null, '', '   '])('accepts missing or blank content: %s', (value) => {
      const input = projectInput()
      const result = validateProjectInput({ ...input, specification: { ...input.specification, [section]: value } })
      expect(result.specification[section as keyof typeof result.specification]).toBeNull()
      expect(result.specification.objectives).toBe(input.specification.objectives)
    })
    it('preserves supplied text without replacing the other optional sections', () => {
      const input = projectInput()
      const specification = { ...input.specification, [section]: 'Première ligne\nDeuxième ligne' }
      expect(validateProjectInput({ ...input, specification }).specification).toEqual(specification)
    })
  })

  it('preserves supplied DB architecture', () => {
    const input = projectInput()
    input.specification.databaseArchitecture = 'Tables clients, commandes et produits.'
    expect(validateProjectInput(input)).toEqual(input)
  })

  it.each(['objectives', 'stakes', 'businessConstraints', 'softwareArchitecture', 'toolsAndFrameworks'])('requires section %s', (section) => {
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
