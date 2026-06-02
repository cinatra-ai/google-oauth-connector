// Google OAuth is registered as a first-class connector extension. The
// operator-facing setup page is OWNED IN-PACKAGE (SDK-only decouple):
// both the render and the save action resolve the OAuth facade through ONE SDK
// host-injected DI slot — `requireGoogleOAuthConnectionProvider()` — bound by the
// host at boot. The connector requests NO host ctx ports. The runtime OAuth code
// stays HOST-side at `@cinatra-ai/google-oauth-connection` (imported by
// `src/lib/auth.ts`, `src/app/layout.tsx`, and the host provider binder) — NOT a
// dependency of this connector.

import type { HostRequiredPackageDefinition } from "@cinatra-ai/sdk-extensions";

export const googleOAuthConnectorPackage: HostRequiredPackageDefinition = {
  packageId: "@cinatra-ai/google-oauth-connector",
  name: "Google OAuth",
  slug: "connector-google-oauth",
  description:
    "Operator-facing setup page for Google OAuth. Runtime client credentials stay at @cinatra-ai/google-oauth-connection (host-side, not a dependency of this package).",
  settingsHref: "/connectors/cinatra-ai/google-oauth-connector/setup",
};
