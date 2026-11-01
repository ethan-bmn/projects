# Sending devis from a project

Deploy with `docker compose --env-file .env.production up -d --build --wait`.
The app entrypoint applies the mail, DocuSign, and delivery-history migrations.
No database port needs to be exposed. Configure the integrations in **Paramètres**;
there are no SMTP or DocuSign credentials to add to `.env.production`.

## SMTP and message templates

In **Paramètres → Envoi des devis**, enter the SMTP hostname, port, encryption,
username, and password provided by your email service. Choose STARTTLS for port
587 or TLS for port 465, as specified by your provider. Certificate verification
stays enabled. An internal authenticated relay may use another port; an empty
username disables SMTP authentication but still requires TLS.

Set the sender email and name, and optionally a reply-to address. Your provider
must permit the chosen sender. Save first, then use **Vérifier la connexion
enregistrée**. This tests connectivity and authentication without sending an email;
it does not guarantee that the provider permits the sender or that a recipient
will receive mail. A blank SMTP password input preserves the saved password.

Configure the subject and plain-text message with these case-sensitive variables:

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
is also bounded. DocuSign requires a rendered subject of at most 100 characters
and a message of at most 10,000 characters.

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

## Connecting DocuSign

Create a DocuSign integration configured for confidential Authorization Code
Grant, with an integration key and secret. In **Paramètres → Signature DocuSign**:

1. Select the matching development or production environment.
2. Enter the integration key and secret.
3. Enter your app's exact public URL followed by `/api/docusign/callback` and add
   that exact URL to the integration's Redirect URIs in DocuSign. HTTPS is required,
   except for local development on localhost/127.0.0.1.
4. Save, then select **Connecter le compte** and authorize `signature extended`.

The app uses the default account returned by DocuSign's userinfo endpoint and
refreshes access tokens automatically. A revoked or expired authorization requires
reconnecting. Production requires a production-enabled integration and an account
with the appropriate eSignature API access. Saving integration settings disconnects
the current account; a blank secret input preserves the stored secret. Disconnecting
removes local tokens; revoke the app separately in DocuSign if needed.

In the project, choose **Créer une demande DocuSign** and enter the human signer's
full name (especially for business customers). After SMTP accepts the PDF email,
the app creates and sends a DocuSign envelope with the same PDF and rendered
subject/message. DocuSign sends a **separate email** containing its secure signing
link. The app uses [free-form signing](https://www.docusign.com/blog/developers/common-api-tasks-let-your-signers-decide-where-to-place-the-tabs-you):
the recipient places their own signature on the document. It does not add fixed
signature fields to the Abby PDF. The envelope ID appears in the app's history;
use DocuSign to inspect completion or void an invitation. Completion is not synced
back to Abby or the project.

See DocuSign's [Authorization Code Grant documentation](https://developers.docusign.com/platform/auth/confidential-authcode-get-token/)
for integration setup and token behavior.

## History and failures

Each send has a persisted unique request ID. Rechecking that request does not send
the email again. History distinguishes SMTP acceptance from actual delivery; SMTP
acceptance does not mean the message reached the inbox. It also tracks the separate
DocuSign invitation. Sending is limited to five attempts per project per minute.

If SMTP succeeds but DocuSign rejects the request, fix the connection and select
**Envoyer l’invitation DocuSign uniquement** in history. This retries the original
PDF and notification without resending the SMTP email. An interrupted signature
request is not retried automatically because DocuSign may already have accepted it.

Network timeouts or process crashes can leave an uncertain result. Check your mail
provider and DocuSign before preparing a new send. Refresh history after an
interrupted request; after ten minutes it marks stale in-progress work as requiring
verification. **Préparer un nouvel envoi** creates a new request and can send a
second email. Failures are not silently retried in the background.

SMTP passwords, integration secrets, and DocuSign tokens are encrypted in PostgreSQL
using a key derived from `NUXT_SESSION_PASSWORD`. Keep that secret stable and back
it up separately from the database. If you rotate it, re-enter credentials and
reconnect DocuSign. Settings responses never return saved passwords or tokens.
Backups contain delivery recipients and message text. PDFs are retained only
while needed for a pending, failed, or uncertain signature request and removed after a confirmed
invitation; deleting a project removes its delivery records.

## Validation

Integration tests use an isolated PostgreSQL database and mocked Abby, SMTP, and
DocuSign services. They cover migration reruns, protected settings, OAuth state
expiry/reuse, encrypted credentials, token refresh, PDF validation, duplicate-send
prevention, stale previews, and signature retries without duplicate SMTP mail.
Real SMTP delivery and DocuSign invitations require configuring your accounts;
the test suite does not send customer emails or create live envelopes.

Manual checks were performed against an isolated production container using
fixture data: settings save, rendered email preview, simulated send/history,
DocuSign signer preview, desktop (1280 px) and mobile (390 px), light and dark
appearance. No horizontal overflow or uncaught browser errors were found.
Outgoing email/signature requests were mocked for these browser checks.
