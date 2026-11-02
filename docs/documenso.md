# Bundled Documenso signing

The Compose stack includes Documenso v2.21.1 and a separate PostgreSQL service,
`documenso-postgres`. Its `documenso_postgres_data` volume stores accounts,
documents, signatures, and audit records. The Abby Projects database and volume
stay separate. Both database services remain private.

## Coolify setup

Deploy the repository's `docker-compose.yaml`. Add a third HTTPS domain, for
example `https://sign.example.com`, routed to the **documenso service, port 3000**.
Set `DOCUMENSO_PUBLIC_URL` to that exact origin. This is the public address used
in signer emails; it must be reachable by your clients. Keep signer routes
accessible if you configure authentication in your reverse proxy.

Copy the new `DOCUMENSO_*` settings from [.env.example](../.env.example) into
Coolify's runtime environment. Existing installations must add these before
redeploying:

| Setting | Value |
| --- | --- |
| `DOCUMENSO_PUBLIC_URL` | Public HTTPS origin, without a path |
| `DOCUMENSO_POSTGRES_PASSWORD` | Independent database password |
| `DOCUMENSO_AUTH_SECRET` | Independent random secret of at least 32 characters |
| `DOCUMENSO_ENCRYPTION_KEY` | Independent random secret of at least 32 characters |
| `DOCUMENSO_ENCRYPTION_SECONDARY_KEY` | Independent random secret of at least 32 characters |
| `DOCUMENSO_SMTP_HOST` | Reachable SMTP server |
| `DOCUMENSO_SMTP_PORT` | Usually 587 for STARTTLS or 465 for implicit TLS |
| `DOCUMENSO_SMTP_SECURE` | `false` for STARTTLS; `true` for implicit TLS |
| `DOCUMENSO_SMTP_USERNAME`, `DOCUMENSO_SMTP_PASSWORD` | SMTP authentication, if required |
| `DOCUMENSO_SMTP_FROM_ADDRESS` | Sender authorized by your mail provider |
| `DOCUMENSO_SMTP_FROM_NAME` | Defaults to Abby Projects |
| `DOCUMENSO_SIGNING_CERTIFICATE` | Single-line base64-encoded password-protected P12 certificate |
| `DOCUMENSO_SIGNING_PASSPHRASE` | Password of that certificate |
| `DOCUMENSO_DISABLE_SIGNUP` | Defaults to `true`; see account setup below |

Generate each secret separately using `openssl rand -hex 32`. Enter raw values
in Coolify. For Compose environment files, single-quote passwords containing
`$`. The container entrypoint percent-encodes database credentials automatically.
No manually constructed Documenso database URL is needed.

Documenso sends account verification and signing invitations using its own SMTP
configuration. SMTP saved in the Abby Projects settings screen sends the quote
email and does not configure Documenso. You can use the same mail provider for
both, but configure it in both places.

## Signing certificate

Provide a password-protected PKCS#12 certificate with its private key and any
required chain. Keep the certificate and password backed up outside the repo.
For a self-signed certificate, run locally on Linux, macOS, or WSL:

```sh
openssl genrsa -out private.key 2048
openssl req -new -x509 -key private.key -out certificate.crt -days 365
openssl pkcs12 -export -out certificate.p12 -inkey private.key -in certificate.crt
openssl pkcs12 -in certificate.p12 -noout
```

Choose a nonempty export password and set it as `DOCUMENSO_SIGNING_PASSPHRASE`.
Encode the certificate on Linux with `base64 -w 0 certificate.p12`, or in
PowerShell with:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path certificate.p12)))
```

Store that output as `DOCUMENSO_SIGNING_CERTIFICATE` in Coolify. A self-signed
certificate does not provide public certificate trust in PDF readers. See
[Documenso's certificate guide](https://docs.documenso.com/docs/self-hosting/configuration/signing-certificate/local)
for certificate and trust requirements. This stack's health check requires both
the database and signing certificate checks to report ready.

## First account and app connection

1. Temporarily set `DOCUMENSO_DISABLE_SIGNUP=false` and deploy the stack.
2. Open the signing domain, create your account, verify its email, and create
   your organization/team in Documenso. This account is separate from the app owner.
3. Create an API token in your team's settings.
4. In Abby Projects, open **Paramètres → Signature Documenso**, paste the token,
   and save. The app encrypts it with `NUXT_SESSION_PASSWORD` and never returns it
   in settings responses. A blank input preserves the saved token.
5. Restore `DOCUMENSO_DISABLE_SIGNUP=true` and redeploy Documenso. Invited clients
   use their signing links; they do not need to register an account.
6. Send a test quote to an address you control. Complete the signing flow and
   download its signed files and audit record in Documenso before using it with clients.

The app talks to `http://documenso:3000` inside the Compose network and opens the
public origin for the browser. No DocuSign OAuth integration is needed. Revoke
old DocuSign authorizations separately if you used the previous integration.

## Local access, updates, and backups

With `docker-compose.host.yaml`, Documenso binds only to
`127.0.0.1:${DOCUMENSO_PORT:-8082}`. For a standalone Nuxt development server, set
`NUXT_DOCUMENSO_URL` to a reachable instance and `NUXT_PUBLIC_DOCUMENSO_URL` to
its browser origin. Compose supplies these automatically for the app service.

Deploy updates with the usual `docker compose --env-file .env.production up -d
--build --wait` command. The pinned upstream image runs its own migrations at
startup. Review upstream release notes and back up before changing its version
in `docker/documenso/Dockerfile`.

Back up Documenso separately from the app:

```sh
docker compose --env-file .env.production exec -T documenso-postgres pg_dump -U documenso -d documenso -Fc > documenso.dump
```

Retain all three Documenso secrets, the certificate and passphrase, the app's
session secret, and both database backups. Changing the database environment
password does not update credentials stored in an existing volume. Ordinary
container replacement preserves data; do not delete volumes to repair a password.

## Troubleshooting

Check `documenso` and `documenso-postgres` logs and the public
`/api/health` and `/api/certificate-status` endpoints. Database DNS failures
require a shared network with the `documenso-postgres` alias. For authentication
failures, reconcile the configured password with the existing database role.
An unhealthy certificate check requires verifying the P12 contents, password,
and validity. Missing invitations require checking Documenso's SMTP settings
and provider logs. The token must belong to the team that should own the envelopes;
check that team's API and document limits if a request is rejected.

Reference: [Documenso self-hosting](https://docs.documenso.com/docs/self-hosting).
