# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**Google OAuth:**
- Google Cloud OAuth 2.0 — Provides sign-in and delegated access for Gmail, Google Calendar, and YouTube
  - Credentials configured via this connector's setup UI: OAuth Client ID and OAuth Client Secret
  - Credentials stored host-side through `requireGoogleOAuthConnectionProvider().saveSettings()`
  - Operator must register redirect URIs in Google Cloud console (UI displays both URIs)

**Nango (OAuth proxy):**
- Nango — OAuth token management proxy used for the OAuth redirect/callback URI
  - Callback URL resolved host-side via `requireGoogleOAuthConnectionProvider().getOAuthCallbackUrl()`
  - URI displayed read-only in setup form (`src/settings-panel.tsx`) so operator can register it in Google Cloud

**BetterAuth:**
- BetterAuth — Application-level sign-in callback handler
  - Callback URI pattern: `${BETTER_AUTH_URL}/api/auth/callback/google`
  - `BETTER_AUTH_URL` env var must be set in the host; defaults to `http://localhost:3000` (`src/setup-page.tsx`)

## Data Storage

**Databases:**
- Not applicable — this connector package has no direct database access. OAuth credentials are persisted host-side through the `requireGoogleOAuthConnectionProvider()` DI facade

**File Storage:**
- Not applicable

**Caching:**
- Not applicable

## Authentication & Identity

**Auth Provider:**
- Google OAuth 2.0 via the Cinatra SDK DI contract
  - This package: exposes operator-facing setup UI and a `saveGoogleOAuthConnectionAction` server action (`src/actions.ts`)
  - Authorization gate: `requireExtensionAction("@cinatra-ai/google-oauth-connector", "manage")` from `@cinatra-ai/sdk-extensions` — covers `org_owner`, `org_admin`, `platform_admin` roles, fail-closed
  - Runtime OAuth execution: host-side in `@cinatra-ai/google-oauth-connection` (not imported by this package)
  - DI binding: host registers provider via `setGoogleOAuthConnectionProvider` (in host's `src/lib/register-google-oauth-provider.ts`); this package resolves it via `requireGoogleOAuthConnectionProvider()`

**Connector Identity:**
- Package ID: `@cinatra-ai/google-oauth-connector`
- Slug: `connector-google-oauth`
- Setup route: `/connectors/cinatra-ai/google-oauth-connector/setup`

## Monitoring & Observability

**Error Tracking:**
- Not detected — errors surface through the host's `useNotify` toast system (`src/settings-form.tsx`) and Next.js error boundaries

**Logs:**
- No explicit logging in this package; errors are caught and re-thrown with human-readable messages in `src/actions.ts`

## CI/CD & Deployment

**Hosting:**
- Consumed as an npm package by the Cinatra host application (not deployed standalone)
- GitHub Actions workflow directory `.github/` present (contents not inspected)

**CI Pipeline:**
- `.github/` directory present — pipeline details not read

## Environment Configuration

**Required env vars:**
- `BETTER_AUTH_URL` — Base URL of the host application for constructing the BetterAuth Google sign-in callback URI (used in `src/setup-page.tsx`)

**Secrets location:**
- `.npmrc` present — likely contains npm registry auth token (not read)
- OAuth client credentials (Client ID, Client Secret) are stored host-side through the DI provider, never persisted within this package

## Webhooks & Callbacks

**Incoming:**
- Not applicable — this package has no webhook receivers

**Outgoing:**
- Not applicable — the connector itself does not make outbound webhook calls; OAuth callback URIs are registered in Google Cloud by the operator and handled by Nango and BetterAuth on the host

---

*Integration audit: 2026-06-09*
