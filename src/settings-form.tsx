"use client";

import { useNotify } from "@cinatra-ai/sdk-ui";
import { saveGoogleOAuthConnectionAction } from "./actions";
import { GoogleOAuthSettingsPanel } from "./settings-panel";

type GoogleOAuthSettingsFormProps = {
  administration: {
    clientId?: string;
    // Write-only: the client SECRET value is never sent to the browser. The host
    // only tells the form whether a secret is already stored, so it can show a
    // "saved" affordance. Submitting a blank secret keeps the stored value.
    clientSecretSet?: boolean;
  };
  status: {
    status: "connected" | "incomplete" | "not_connected";
    accountEmail?: string;
    detail?: string;
  };
  showConnectionActions?: boolean;
  nangoCallbackUri?: string;
  betterAuthCallbackUri?: string;
};

export function GoogleOAuthSettingsForm({
  administration,
  status,
  showConnectionActions,
  nangoCallbackUri,
  betterAuthCallbackUri,
}: GoogleOAuthSettingsFormProps) {
  const { addNotification } = useNotify();

  async function handleSubmit(formData: FormData) {
    try {
      await saveGoogleOAuthConnectionAction(formData);
      addNotification({
        title: "Google OAuth connection saved",
        body: "Google OAuth settings have been updated.",
        kind: "success",
      });
    } catch {
      // In a Next.js production build, a thrown Server Action error reaches
      // this catch with its real message replaced by the framework's generic
      // masking blurb, so the caught message is never useful UI copy. Show
      // friendly operation-specific copy unconditionally; the server-side
      // logging of the real failure is unchanged.
      addNotification({
        title: "Google OAuth save failed",
        body: "Unable to save the Google OAuth connection.",
        kind: "error",
      });
    }
  }

  return (
    <GoogleOAuthSettingsPanel
      settings={administration}
      status={status}
      action={handleSubmit}
      showConnectionActions={showConnectionActions}
      nangoCallbackUri={nangoCallbackUri}
      betterAuthCallbackUri={betterAuthCallbackUri}
    />
  );
}
