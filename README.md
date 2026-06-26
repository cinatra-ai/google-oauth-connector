# Google OAuth

Set up Google sign-in for your workspace and connect every Google-backed service through a single shared OAuth client. One Google Cloud project, configured once, becomes the identity foundation that Gmail, Google Calendar, and YouTube all reuse when an account is linked.

**Setup.** In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) go to APIs & Services → Credentials → Create credentials → OAuth client ID and choose application type **Web application**. Copy the client ID and secret, then open the Google OAuth connector setup page in your Cinatra workspace, paste both values, and click **Save Google OAuth**. The page shows two redirect URIs that must be registered in Google Cloud before the OAuth flow will work.

**Configuration notes.** The client secret is write-only: the setup page never displays a saved secret. Leave the secret field blank when saving to keep the existing value. The connector status shows "Connected" once a Google account is linked, "Setup required" if credentials are missing, and "Not connected" if no account has been linked yet.

**API contract.** The package exports `googleOAuthConnectorPackage` (a `HostRequiredPackageDefinition` descriptor) from the default entry. The `./setup-page` export provides the React server component for the setup UI; `./actions` exports `saveGoogleOAuthConnectionAction`. Runtime OAuth logic is injected via the SDK's `requireGoogleOAuthConnectionProvider()` DI slot; this package has no direct runtime dependency on it.

**Development.** Run `npm test` (Vitest) to execute the test suite and `npm run lint` to check style. No live Google credentials are needed to run tests.

**Troubleshooting.** If saving returns an error, confirm the OAuth client in Google Cloud is type **Web application**. If status stays "Setup required" after saving, reload the page to confirm the client ID was stored. If the OAuth redirect fails, verify both redirect URIs shown on the setup page are registered exactly in Google Cloud.

## Works with

- Gmail
- Google Calendar
- YouTube

## Capabilities

- Sign in to your Cinatra workspace with a Google account
- Connect Google-backed services without configuring a separate OAuth client for each
- Switch the workspace's Google identity provider in one place when credentials need to be rotated
