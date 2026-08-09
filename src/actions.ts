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
import { revalidatePath } from "next/cache";
import {
  requireExtensionAction,
  requireGoogleOAuthConnectionProvider,
} from "@cinatra-ai/sdk-extensions";

const googleOAuthConnectorSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

// This connector's own setup route — the SAME string `./index.ts` declares as
// `settingsHref`, pinned equal by `src/__tests__/setup-revalidate-action.test.ts`
// so the two literals cannot drift apart silently. Held as a literal HERE rather
// than in a shared module because a `"use server"` file may only export async
// functions, and a new sibling module would add a node to every route graph
// that reaches this connector for a single constant.
const SETUP_PATH = "/connectors/cinatra-ai/google-oauth-connector/setup";
// The connectors card grid renders the host connection badge for this connector
// from the same status this save changes, so it is refreshed with the setup
// route (the sibling tailscale-connector revalidates the same pair).
const CONNECTORS_INDEX_PATH = "/connectors";

/**
 * A CLOSED description of WHAT was thrown, for the server log.
 *
 * Deliberately neither `error.message` nor `error.name`: both are writable, so
 * a connection-service client that echoes a request back into the error it
 * raises could put the submitted client secret in either one. The return value
 * is always one of a fixed set of strings, so this connector's logs can never
 * become a place a credential lands. The classified CAUSE of a connection-
 * service failure is already logged by the provider itself (cinatra#2552).
 */
function describeThrownShape(error: unknown): string {
  return error instanceof Error ? "error" : typeof error;
}

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
    // Never re-throw the provider's own message. `saveSettings` reaches the
    // connection service, so its error text is untrusted — an HTTP error body
    // can echo back what was sent, including the client secret — and Next.js
    // replaces a thrown Server Action message with a generic blurb only in a
    // PRODUCTION build; a development build serializes the real message to the
    // browser. Nothing is lost by dropping it: the form shows static copy for a
    // failed save either way (`settings-form.tsx`). Same rail cinatra#2552 set
    // server-side — the provider already logs its OWN classified failure code
    // there, so this line only has to mark which call failed.
    console.error("[connector-google-oauth] saveGoogleOAuthConnectionAction failed", {
      threw: describeThrownShape(error),
    });
    throw new Error("Unable to save the Google OAuth connection.");
  }

  // The save has LANDED. Refresh the server-rendered setup route so the panel
  // re-reads the STORED configuration and status instead of re-rendering its
  // pre-save props (google-oauth-connector#57). Without this the action returns
  // no revalidation, the RSC tree the browser holds stays the pre-save one, and
  // React 19's post-action `<form>` reset restores the client-id input to its
  // now-stale empty `defaultValue` — the "save cleared my fields" report. It
  // also drops the client Router Cache entry, so a soft nav back to the page
  // shows the saved state too.
  //
  // Guarded for the same reason the status read-back below is: once the save has
  // landed, NOTHING after it may reject. The caller treats a rejection as "your
  // values were not stored" and puts the operator's typed values back for a
  // retry — which would be a lie about a save that did land, and would invite a
  // pointless second write.
  // Guarded per path: the two are independent surfaces, so one failing must not
  // cost the other its refresh.
  for (const path of [SETUP_PATH, CONNECTORS_INDEX_PATH]) {
    try {
      revalidatePath(path);
    } catch (error) {
      // The page still re-reads on the next full load; only the immediate
      // in-place refresh of THIS path is lost.
      console.error("[connector-google-oauth] post-save revalidate failed", {
        path,
        threw: describeThrownShape(error),
      });
    }
  }

  // Read the resulting status back through the SAME facade the setup page
  // renders from, so the toast can be honest about a save that persisted but
  // could not be mirrored to the connection service — cinatra#2552 made that
  // path DEGRADE (status "incomplete" + a classified explanation) instead of
  // throwing, so a bare "saved" toast would now be the only thing an operator
  // sees at the moment the mirror fails.
  //
  // Only the classified ENUM crosses this boundary. `status.detail` is
  // server-rendered into the panel by the revalidated render and is never
  // serialized to the browser through here, so no provider-influenced text can
  // ride out on the action result.
  let status: "connected" | "incomplete" | "not_connected" | undefined;
  try {
    status = (await requireGoogleOAuthConnectionProvider().getStatus()).status;
  } catch (error) {
    // A read-back failure must never turn a landed save into a reported
    // failure. The revalidated render owns the durable state either way; the
    // toast just falls back to the plain success copy.
    console.error("[connector-google-oauth] post-save status read-back failed", {
      threw: describeThrownShape(error),
    });
  }
  return { status };
}
