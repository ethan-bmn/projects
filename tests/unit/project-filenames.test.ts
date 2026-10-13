import { describe, expect, it } from 'vitest'
import { projectSvgFilename } from '../../shared/utils/project-filenames'

describe('SVG export filenames', () => {
  it.each([
    ['../Été : œuvre / schéma?', 'architecture-db-ete-oeuvre-schema.svg'],
    [' / : ? ', 'architecture-db-projet.svg'],
    ['a'.repeat(200), `architecture-db-${'a'.repeat(80)}.svg`]
  ])('uses safe readable filenames for %s', (name, expected) => {
    expect(projectSvgFilename(name)).toBe(expected)
  })
})
