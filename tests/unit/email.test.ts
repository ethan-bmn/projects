import { describe, expect, it } from 'vitest'
import { emailAddress, renderEmailTemplate, validateEmailTemplate } from '../../server/services/email-templates'
import { decryptSetting, encryptSetting } from '../../server/services/settings-secrets'
import { validateMailSettings } from '../../server/services/mail-settings'
import { mailSettingsInput, settingsSecret } from '../helpers/email'

const values = {
  PROJECT_NAME: 'Refonte ${CLIENT_NAME}', CLIENT_NAME: 'Émilie Martin', CLIENT_EMAIL: 'client@example.test',
  QUOTE_NUMBER: 'D-001', QUOTE_TITLE: 'Site web', QUOTE_AMOUNT: '1 200,00 €', SENDER_NAME: 'Atelier', SIGNATURE_LINK: ''
}

describe('email templates', () => {
  it('replaces every supported variable without evaluating or expanding customer text', () => {
    expect(renderEmailTemplate('${PROJECT_NAME} — ${CLIENT_NAME} — ${QUOTE_NUMBER}', values, true)).toBe('Refonte ${CLIENT_NAME} — Émilie Martin — D-001')
    expect(renderEmailTemplate('Bonjour ${CLIENT_NAME},\n${QUOTE_AMOUNT}\n${SIGNATURE_LINK}', values)).toBe('Bonjour Émilie Martin,\n1 200,00 €\n')
  })

  it.each(['${UNKNOWN}', '${project_name}', '${process.env.SECRET}', '${PROJECT_NAME', '', 'a'.repeat(10001)])('rejects invalid templates: %s', (template) => {
    expect(() => validateEmailTemplate(template)).toThrow()
  })

  it('rejects header injection and oversized rendered subjects', () => {
    expect(() => validateEmailTemplate('Objet\r\nBcc: other@example.test', true)).toThrow()
    expect(() => renderEmailTemplate('${CLIENT_NAME}', { ...values, CLIENT_NAME: 'Client\nBcc: other@example.test' }, true)).toThrow()
    expect(() => renderEmailTemplate('${PROJECT_NAME}${PROJECT_NAME}', { ...values, PROJECT_NAME: 'x'.repeat(200) }, true)).toThrow()
  })

  it.each(['a@example.test,b@example.test', 'Client <a@example.test>', 'x\r\nBcc:y@example.test', 'bad', 'a\0@example.test'])('rejects invalid recipients: %s', (address) => {
    expect(() => emailAddress(address)).toThrow()
  })

  it('normalizes a single email address', () => {
    expect(emailAddress('CLIENT@example.test')).toBe('client@example.test')
  })
})

describe('SMTP settings and secrets', () => {
  it('encrypts secrets with authenticated random ciphertext and rejects tampering or changed keys', () => {
    const encrypted = encryptSetting('private-password', settingsSecret)
    expect(encrypted).not.toContain('private-password')
    expect(encrypted).not.toBe(encryptSetting('private-password', settingsSecret))
    expect(decryptSetting(encrypted, settingsSecret)).toBe('private-password')
    expect(() => decryptSetting(encrypted, `${settingsSecret}-changed`)).toThrow('déchiffrer')
    const parts = encrypted.split('.')
    parts[2] = Buffer.from('tampered').toString('base64url')
    expect(() => decryptSetting(parts.join('.'), settingsSecret)).toThrow('déchiffrer')
    expect(() => encryptSetting('password', 'short')).toThrow('32')
  })

  it('accepts TLS SMTP settings while rejecting bad ports, headers, hosts and templates', () => {
    expect(validateMailSettings(mailSettingsInput)).toMatchObject({ smtpPort: 587, smtpSecurity: 'starttls' })
    for (const changes of [{ smtpPort: 0 }, { smtpPort: 1.5 }, { smtpSecurity: 'none' }, { smtpHost: 'smtp://example.test' }, { fromEmail: 'a@example.test,b@example.test' }, { fromName: 'Owner\r\nBcc: other' }, { subjectTemplate: '${UNKNOWN}' }]) {
      expect(() => validateMailSettings({ ...mailSettingsInput, ...changes })).toThrow()
    }
  })
})
