import type postgres from 'postgres'
import nodemailer from 'nodemailer'
import type { EmailSettings } from '../../shared/types/email'
import { emailAddress, hasEmailControls, validateEmailTemplate } from './email-templates'
import { decryptSetting, encryptSetting } from './settings-secrets'
import { SettingsError } from './settings'

function field(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max || hasEmailControls(value)) throw new SettingsError('Les paramètres SMTP sont invalides.')
  return value.trim()
}

export function validateMailSettings(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SettingsError('Les paramètres e-mail sont invalides.')
  const input = value as Record<string, unknown>
  const smtpHost = field(input.smtpHost, 253)
  if (smtpHost && !/^[a-zA-Z0-9.-]+$/.test(smtpHost)) throw new SettingsError('Le nom du serveur SMTP est invalide.')
  const smtpPort = input.smtpPort
  if (typeof smtpPort !== 'number' || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new SettingsError('Le port SMTP est invalide.')
  const smtpSecurity = input.smtpSecurity
  if (smtpSecurity !== 'tls' && smtpSecurity !== 'starttls') throw new SettingsError('Choisissez TLS ou STARTTLS.')
  const smtpPassword = input.smtpPassword
  if (typeof smtpPassword !== 'string' || smtpPassword.length > 4096 || hasEmailControls(smtpPassword)) throw new SettingsError('Le mot de passe SMTP est invalide.')
  return {
    smtpHost, smtpPort, smtpSecurity,
    smtpUsername: field(input.smtpUsername, 320), smtpPassword,
    fromEmail: emailAddress(input.fromEmail, true), fromName: field(input.fromName, 200),
    replyTo: emailAddress(input.replyTo, true),
    subjectTemplate: validateEmailTemplate(input.subjectTemplate, true),
    bodyTemplate: validateEmailTemplate(input.bodyTemplate)
  }
}

export async function getMailSettings(sql: postgres.Sql): Promise<EmailSettings> {
  const [row] = await sql`
    SELECT smtp_host AS "smtpHost", smtp_port AS "smtpPort", smtp_security AS "smtpSecurity",
      smtp_username AS "smtpUsername", smtp_password <> '' AS "smtpPasswordConfigured",
      from_email AS "fromEmail", from_name AS "fromName", reply_to AS "replyTo",
      subject_template AS "subjectTemplate", body_template AS "bodyTemplate"
    FROM mail_settings WHERE id = 1
  `
  if (!row) throw new SettingsError('Appliquez les migrations pour configurer les e-mails.', 503)
  return { ...row, configured: Boolean(row.smtpHost && row.fromEmail && (!row.smtpUsername || row.smtpPasswordConfigured)) } as EmailSettings
}

export async function saveMailSettings(sql: postgres.Sql, value: unknown, secret: string) {
  const input = validateMailSettings(value)
  const password = encryptSetting(input.smtpPassword, secret)
  await sql`
    UPDATE mail_settings SET smtp_host = ${input.smtpHost}, smtp_port = ${input.smtpPort},
      smtp_security = ${input.smtpSecurity}, smtp_username = ${input.smtpUsername},
      smtp_password = CASE WHEN ${password} <> '' THEN ${password} ELSE smtp_password END,
      from_email = ${input.fromEmail}, from_name = ${input.fromName}, reply_to = ${input.replyTo},
      subject_template = ${input.subjectTemplate}, body_template = ${input.bodyTemplate}, updated_at = now()
    WHERE id = 1
  `
  return getMailSettings(sql)
}

export async function mailTransport(sql: postgres.Sql, secret: string) {
  const settings = await getMailSettings(sql)
  if (!settings.configured) throw new SettingsError('Configurez le serveur SMTP et l’expéditeur dans les paramètres.', 409)
  const [row] = await sql<{ smtp_password: string }[]>`SELECT smtp_password FROM mail_settings WHERE id = 1`
  const transport = nodemailer.createTransport({
    host: settings.smtpHost, port: settings.smtpPort, secure: settings.smtpSecurity === 'tls',
    requireTLS: settings.smtpSecurity === 'starttls',
    auth: settings.smtpUsername ? { user: settings.smtpUsername, pass: decryptSetting(row!.smtp_password, secret) } : undefined,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    disableFileAccess: true, disableUrlAccess: true
  })
  return { settings, transport }
}
