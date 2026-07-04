// Dispatch-route entry for the Google OAuth connector setup page.
//
// Owns the setup-impl IN-PACKAGE (SDK-only decouple): the OAuth data
// facade is resolved through the SDK's host-injected
// `requireGoogleOAuthConnectionProvider()` DI slot (bound at boot by
// src/lib/register-google-oauth-provider.ts) — the connector never imports the
// host runtime package `@cinatra-ai/google-oauth-connection`. The same slot
// backs the save action at `./actions` (which can't close over ctx). Using one
// SDK DI contract for both render and action keeps the connector off the host
// `ctx.capabilities` registry entirely.

import { Main, PageHeader, PageContent } from "@cinatra-ai/sdk-ui/marketplace";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { requireGoogleOAuthConnectionProvider } from "@cinatra-ai/sdk-extensions";
import { GoogleOAuthSettingsForm } from "./settings-form";

type ConnectorSetupPageProps = {
  packageId: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
  ctx: ExtensionHostContext;
};

export default async function GoogleOAuthConnectorSetupPage({ ctx }: ConnectorSetupPageProps) {
  // Resolve the host-bound facade via the SDK DI slot. Fails CLOSED (throws) if
  // the host never wired it — a boot-wiring bug, surfaced by the route's error
  // boundary rather than silently rendering an empty form.
  const facade = requireGoogleOAuthConnectionProvider();

  const [settings, status] = await Promise.all([facade.getSettings(), facade.getStatus()]);
  const nangoCallbackUri = facade.getOAuthCallbackUrl();
  // App base URL comes from the host through the ambient `ctx.runtime` port —
  // extension code must not read `process.env` directly (host/extension
  // boundary). The host resolves its auth base URL behind this port; the
  // localhost fallback mirrors the host's own dev default.
  const appBaseUrl = ctx.runtime.publicBaseUrl() ?? "http://localhost:3000";
  const betterAuthCallbackUri = `${appBaseUrl}/api/auth/callback/google`;

  // The OAuth client SECRET is write-only: never send it to the client. The form
  // renders the secret field empty + a "saved" indicator; saving a blank secret
  // KEEPS the stored value (saveGoogleOAuthSettings merges `input.clientSecret?.trim()
  // || current.clientSecret`). The clientId is not secret (it appears in the OAuth
  // authorization URL the browser already sees), so it is pre-filled.
  const administration = {
    clientId: settings.clientId,
    clientSecretSet: Boolean(settings.clientSecret),
  };

  return (
    <Main className="min-h-screen">
      <PageHeader title="Google OAuth" description="API setup" className="max-w-3xl" />
      <PageContent className="max-w-3xl flex flex-col gap-6 pb-8">
        <GoogleOAuthSettingsForm
          administration={administration}
          status={status}
          showConnectionActions={false}
          nangoCallbackUri={nangoCallbackUri}
          betterAuthCallbackUri={betterAuthCallbackUri}
        />
      </PageContent>
    </Main>
  );
}
