import { defaultEmailBody, defaultEmailSubject } from '../../shared/types/email'

export const settingsSecret = 'test-settings-secret-at-least-32-characters'
export const mailSettingsInput = {
  smtpHost: 'smtp.example.test', smtpPort: 587, smtpSecurity: 'starttls',
  smtpUsername: 'owner@example.test', smtpPassword: 'smtp-test-password',
  fromEmail: 'owner@example.test', fromName: 'Atelier', replyTo: '',
  subjectTemplate: defaultEmailSubject, bodyTemplate: defaultEmailBody
}
