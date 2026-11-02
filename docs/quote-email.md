# Sending devis from a project

Deploy with `docker compose --env-file .env.production up -d --build --wait`.
The app entrypoint applies pending migrations. The stack also starts Documenso
and its own PostgreSQL database. Complete [Documenso deployment and account
setup](documenso.md) first, including its SMTP settings and signing certificate.
Configure the app's SMTP sender and Documenso API token in **Paramètres**.

## SMTP and message templates

In **Paramètres → Expéditeur et SMTP**, enter the SMTP hostname, port, encryption,
username, and password provided by your email service. Choose STARTTLS for port
587 or TLS for port 465, as specified by your provider. Certificate verification
stays enabled. An internal authenticated relay may use another port; an empty
username disables SMTP authentication but still requires TLS.

Set the sender email and name, and optionally a reply-to address. Your provider
must permit the chosen sender. Save first, then use **Vérifier la connexion
enregistrée**. This tests connectivity and authentication without sending an email;
it does not guarantee that the provider permits the sender or that a recipient
will receive mail. A blank SMTP password input preserves the saved password.

Open **Paramètres → Modèles d’e-mail** to configure the subject and plain-text
message with these case-sensitive variables:

| Variable | Value |
| --- | --- |
| `${PROJECT_NAME}` | Project name |
| `${CLIENT_NAME}` | Customer name synchronized from Abby |
| `${CLIENT_EMAIL}` | Selected customer recipient |
| `${QUOTE_NUMBER}` | Abby devis number |
| `${QUOTE_TITLE}` | Abby devis title |
| `${QUOTE_AMOUNT}` | Total including tax, formatted in French with the devis currency |
| `${SENDER_NAME}` | Sender name, or sender email if no name is configured |
| `${SIGNATURE_LINK}` | Optional existing signature link; empty otherwise |

For example, use `Votre devis ${QUOTE_NUMBER} pour ${PROJECT_NAME}` as the subject.
Variables are substituted as plain text once, never executed as code. Unknown
or incomplete variables are rejected. The subject template allows 250 characters
and no line breaks; the message template allows 10,000 characters. Rendered text
is also bounded. Documenso accepts an email subject of at most 254 characters
and a message of at most 5,000 characters; the app's 250-character subject limit
also applies.

## Sending the PDF

Associate a finalized Abby devis with the project. In **Envoyer le devis**, select
an email address recorded for that customer in Abby. If none exists, add one in
Abby and synchronize clients. The server verifies the project's customer and
the devis ownership before rendering or downloading anything.

Choose the signature option, then select **Prévisualiser le message**. Check the
sender, recipient, subject, message, attachment filename, and optional signer name.
Select **Envoyer au client** to send. The app downloads the official PDF through
Abby's [document download endpoint](https://docs.abby.fr/api/factures), checks its
PDF signature and 10 MB size limit, and attaches its bytes. It does not regenerate
the devis or follow third-party download redirects.

If the template or devis metadata changes after preview, the app requires a fresh
preview. With **Inclure un lien de signature existant**, paste an HTTPS link. It
replaces `${SIGNATURE_LINK}` in the message, or is appended if the template does
not include that variable. The app does not fetch this link.

## Connecting Documenso

Open **Paramètres → Signature Documenso**, select **Ouvrir Documenso**, and create
an API token in your team's settings. Save it in the app. No OAuth callback or
external signing subscription is needed. A blank token preserves the saved value;
**Supprimer la clé** removes the local credential. Revoke it separately in
Documenso if needed.

Choose **Créer une demande Documenso** in the project and enter the human signer's
full name. After SMTP accepts the quote email, the app uploads the original Abby
PDF and a separate signature sheet into one Documenso envelope. The sheet records
the delivery reference, quote filename, and SHA-256 of the original quote. Its
signature field avoids covering content on the Abby PDF. Documenso sends a
separate invitation using its configured SMTP sender and public signing domain.
The recipient reviews the quote and signs the accompanying sheet.

The envelope ID appears in history. Use Documenso to view completion, download the
signed documents and audit record, or cancel a request. Invitation status in the
app records sending; completion is not synchronized back to Abby or the project.

Existing DocuSign invitations remain labeled DocuSign in history. They cannot be
retried through Documenso; manage them in DocuSign. Changing provider does not
transfer old envelopes, signatures, or credentials.

## History and failures

Each send has a persisted unique request ID. Rechecking that request does not send
the email again. History distinguishes SMTP acceptance from actual delivery; SMTP
acceptance does not mean the message reached the inbox. It also tracks the separate
Documenso invitation. Sending is limited to five attempts per project per minute.

If SMTP succeeds but Documenso rejects the request, fix the connection and select
**Envoyer l’invitation Documenso uniquement** in history. This retries the original
PDF and notification without resending the SMTP email. If the draft was already
created, its saved envelope ID is reused. An interrupted signature
request is not retried automatically because Documenso may already have accepted it.

Network timeouts or process crashes can leave an uncertain result. Check your mail
provider and Documenso before preparing a new send. Refresh history after an
interrupted request; after ten minutes it marks stale in-progress work as requiring
verification. **Préparer un nouvel envoi** creates a new request and can send a
second email. Failures are not silently retried in the background.

SMTP passwords and the Documenso API token are encrypted in PostgreSQL
using a key derived from `NUXT_SESSION_PASSWORD`. Keep that secret stable and back
it up separately from the database. If you rotate it, re-enter credentials and
save the Documenso token again. Settings responses never return saved passwords or tokens.
Backups contain delivery recipients and message text. PDFs are retained only
while needed for a pending, failed, or uncertain signature request and removed after a confirmed
invitation; deleting a project removes its delivery records.

## Validation

Unit tests cover the multipart API contract, original PDF preservation, signature
sheet, persisted-draft ordering, retries, ambiguous responses, and raw database
credential encoding. Integration tests cover encrypted settings, migration reruns,
legacy-provider history, and signature retries without duplicate SMTP mail.
The tests mock remote signing and do not send customer email.

Before production use, verify the settings and quote-signing form on desktop and
mobile in both themes, send to an address you control, complete signing, and
inspect the signed files in Documenso. Live signing requires working SMTP and a
valid certificate; mocked API tests do not verify those services.
