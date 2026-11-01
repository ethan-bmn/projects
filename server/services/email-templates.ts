import { emailVariables } from '../../shared/types/email'
import type { EmailVariable } from '../../shared/types/email'
import { SettingsError } from './settings'

export function hasEmailControls(value: string, multiline = false) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code === 127 || (code < 32 && !(multiline && ['\t', '\r', '\n'].includes(character)))
  })
}

export function validateEmailTemplate(value: unknown, subject = false): string {
  if (typeof value !== 'string' || !value.trim() || value.length > (subject ? 250 : 10000)
    || hasEmailControls(value, !subject)) {
    throw new SettingsError(subject ? 'L’objet est invalide (250 caractères maximum, une seule ligne).' : 'Le message est invalide (10 000 caractères maximum).')
  }
  const placeholders = value.match(/\$\{[^}]*\}/g) ?? []
  for (const placeholder of placeholders) {
    if (!emailVariables.includes(placeholder.slice(2, -1) as EmailVariable)) {
      throw new SettingsError(`Variable inconnue : ${placeholder}.`)
    }
  }
  if (value.replace(/\$\{[^}]*\}/g, '').includes('${')) throw new SettingsError('Une variable du modèle est incomplète.')
  return value
}

export function renderEmailTemplate(template: string, values: Record<EmailVariable, string>, subject = false) {
  validateEmailTemplate(template, subject)
  // Replace once: customer data is text and is never evaluated or expanded again.
  const result = template.replace(/\$\{([A-Z_]+)\}/g, (_, key: EmailVariable) => values[key])
  if (!result.trim() || result.length > (subject ? 250 : 20000) || hasEmailControls(result, !subject)) {
    throw new SettingsError('Le contenu généré est vide, trop long ou contient un retour à la ligne dans l’objet.')
  }
  return result
}

export function emailAddress(value: unknown, optional = false) {
  if (optional && value === '') return ''
  if (typeof value !== 'string' || value.length > 254 || hasEmailControls(value)
    || !/^[^\s@<>,;:"\\]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/.test(value)) {
    throw new SettingsError('L’adresse e-mail est invalide.')
  }
  return value.toLowerCase()
}
