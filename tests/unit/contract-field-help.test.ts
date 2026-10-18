import { describe, expect, it } from 'vitest'
import { contractChoices, contractConfirmations, contractVariables } from '../../shared/utils/contract-configuration'
import { contractFieldHelp } from '../../shared/utils/contract-field-help'

describe('contract field help', () => {
  const keys = [
    ...contractChoices.filter(field => !field.hidden).map(field => field.key),
    ...contractVariables.filter(field => !field.hidden).map(field => field.key),
    ...contractConfirmations.map(field => `confirmation.${field.key}`),
    'quote'
  ]

  it.each(keys)('explains %s and provides an example', (key) => {
    expect(contractFieldHelp[key]?.explanation.trim().length).toBeGreaterThan(20)
    expect(contractFieldHelp[key]?.example.trim().length).toBeGreaterThan(0)
  })
})
