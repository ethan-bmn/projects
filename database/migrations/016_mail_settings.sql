CREATE TABLE mail_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  smtp_host text NOT NULL DEFAULT '',
  smtp_port integer NOT NULL DEFAULT 587 CHECK (smtp_port BETWEEN 1 AND 65535),
  smtp_security text NOT NULL DEFAULT 'starttls' CHECK (smtp_security IN ('tls', 'starttls')),
  smtp_username text NOT NULL DEFAULT '',
  smtp_password text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  reply_to text NOT NULL DEFAULT '',
  subject_template text NOT NULL,
  body_template text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO mail_settings (id, subject_template, body_template) VALUES (
  1,
  'Votre devis ${QUOTE_NUMBER} — ${PROJECT_NAME}',
  E'Bonjour ${CLIENT_NAME},\n\nVous trouverez en pièce jointe le devis pour le projet ${PROJECT_NAME}, pour un montant de ${QUOTE_AMOUNT}.\n\nJe reste à votre disposition pour toute question.\n\nBien cordialement,\n${SENDER_NAME}'
);
