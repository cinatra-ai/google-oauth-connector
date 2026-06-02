"use server";

// Google OAuth connection server action — relocated from the central host hub
// into the connector itself (SDK-only decouple). Gated by the SDK's
// `requireExtensionAction(pkg, "manage")` rather than a host
// `requireAdminSession` — "manage" on this connector is the right authority
// (org_owner/org_admin/platform_admin, fail-closed) and keeps the connector
// free of `@/lib/auth-session`.
//
// The concrete `saveSettings` impl lives in the HOST runtime package
// (`@cinatra-ai/google-oauth-connection`, under `packages/`), reachable only
// host-side — this server action runs in a separate bundle with no `ctx`, so it
// resolves the impl through the SDK's host-injected
// `requireGoogleOAuthConnectionProvider()` DI slot, bound by the host at boot
// (`src/lib/register-google-oauth-provider.ts` → `setGoogleOAuthConnectionProvider`).

import { z } from "zod";
import {
  requireExtensionAction,
  requireGoogleOAuthConnectionProvider,
} from "@cinatra-ai/sdk-extensions";

const googleOAuthConnectorSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

export async function saveGoogleOAuthConnectionAction(formData: FormData) {
  await requireExtensionAction("@cinatra-ai/google-oauth-connector", "manage");
  const parsed = googleOAuthConnectorSchema.parse({
    clientId: formData.get("clientId") ?? undefined,
    clientSecret: formData.get("clientSecret") ?? undefined,
  });
  try {
    // saveSettings honours the "leave blank to keep the saved value" contract
    // (blank inputs merge with the current saved values), so pass the optional
    // values straight through.
    await requireGoogleOAuthConnectionProvider().saveSettings({
      clientId: parsed.clientId,
      clientSecret: parsed.clientSecret,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save the Google OAuth connection.";
    throw new Error(message);
  }
}
