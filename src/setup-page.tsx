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
//
// Per the extended connector setup-page spec (design/specs/app-connectors.html
// §II — tabbed setup page; config how-to in a Help tab always last), this
// connector holds ONE shared, admin-level OAuth-client configuration — no
// per-user connect/disconnect flow and no multiple instances — so its actual
// connection model is a single flat config tab plus the reserved Help tab.
// `ConnectorSetupPage` supplies the standard Wide-column chrome (`divider=false`
// hands the section rule to the tab row's `TabsListRow` so the two rules never
// stack), and `Tabs`/`TabsListRow`/`TabsTrigger`/`TabsContent` come from the
// shared, connector-agnostic `@cinatra-ai/sdk-ui/tabs` primitive (no vendored
// `tabs.tsx`).

import { ConnectorSetupPage } from "@cinatra-ai/sdk-ui/connector-setup-page";
import { Tabs, TabsContent, TabsListRow, TabsTrigger } from "@cinatra-ai/sdk-ui/tabs";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { requireGoogleOAuthConnectionProvider } from "@cinatra-ai/sdk-extensions";
import { ExternalLink } from "./components/ui/external-link";
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
    <ConnectorSetupPage
      title="Google OAuth"
      description="API setup"
      divider={false}
      className="flex flex-col gap-6 pb-8"
    >
      <Tabs defaultValue="setup" className="w-full">
        <TabsListRow aria-label="Google OAuth connector setup">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          {/* Help is RESERVED and ALWAYS LAST (app-connectors.html §II). */}
          <TabsTrigger value="help">Help</TabsTrigger>
        </TabsListRow>

        {/* SETUP — the single, shared OAuth-client configuration. No
            Connect/Disconnect or Connection-status card: this connector has no
            per-user connection to check, so it stays Wide, single-column. */}
        <TabsContent
          value="setup"
          forceMount
          className="mt-6 data-[state=inactive]:hidden"
        >
          <GoogleOAuthSettingsForm
            administration={administration}
            status={status}
            showConnectionActions={false}
            nangoCallbackUri={nangoCallbackUri}
            betterAuthCallbackUri={betterAuthCallbackUri}
          />
        </TabsContent>

        {/* HELP — reserved, always LAST, read-only (no form, no Save). Narrow,
            per the additional-config-tab treatment. */}
        <TabsContent
          value="help"
          forceMount
          className="mt-6 flex max-w-xl flex-col gap-5 data-[state=inactive]:hidden"
        >
          <p className="text-sm leading-6 text-muted-foreground">
            Cinatra uses these Google OAuth client values to connect Gmail and
            Google Calendar. Mailbox and calendar access require OAuth; API
            keys can be stored here, but they cannot access a user&apos;s
            mailbox or calendar data.
          </p>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Create an OAuth client</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              In the{" "}
              <ExternalLink href="https://console.cloud.google.com/apis/credentials">
                Google Cloud Console
              </ExternalLink>{" "}
              (APIs &amp; Services → Credentials → Create credentials → OAuth
              client ID, application type Web application), create an OAuth
              client, then paste its client ID and secret into the Setup tab
              and register the redirect URIs shown there.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </ConnectorSetupPage>
  );
}
