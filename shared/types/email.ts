export const emailVariables = ['PROJECT_NAME', 'CLIENT_NAME', 'CLIENT_EMAIL', 'QUOTE_NUMBER', 'QUOTE_TITLE', 'QUOTE_AMOUNT', 'SENDER_NAME', 'SIGNATURE_LINK'] as const
export type EmailVariable = typeof emailVariables[number]

export const defaultEmailSubject = 'Votre devis ${QUOTE_NUMBER} — ${PROJECT_NAME}'
export const defaultEmailBody = 'Bonjour ${CLIENT_NAME},\n\nVous trouverez en pièce jointe le devis pour le projet ${PROJECT_NAME}, pour un montant de ${QUOTE_AMOUNT}.\n\nJe reste à votre disposition pour toute question.\n\nBien cordialement,\n${SENDER_NAME}'

export interface EmailSettings {
  smtpHost: string
  smtpPort: number
  smtpSecurity: 'tls' | 'starttls'
  smtpUsername: string
  smtpPasswordConfigured: boolean
  fromEmail: string
  fromName: string
  replyTo: string
  subjectTemplate: string
  bodyTemplate: string
  configured: boolean
}

export interface DocumensoSettings {
  url: string
  configured: boolean
}

export interface QuoteEmailPreview {
  quoteId: string
  to: string
  subject: string
  text: string
  filename: string
  from: string
  replyTo: string
  documenso: boolean
  signerName: string
  previewHash: string
}

export interface QuoteDelivery {
  id: string
  quoteId: string
  to: string
  subject: string
  createdAt: string
  status: 'preparing' | 'sending' | 'sent' | 'failed' | 'uncertain'
  signatureStatus: 'none' | 'pending' | 'sending' | 'sent' | 'failed' | 'uncertain'
  envelopeId: string | null
  signatureProvider: 'docusign' | 'documenso' | null
  error: string | null
}
