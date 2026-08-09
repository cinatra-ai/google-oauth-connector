"use client";

import { useState } from "react";
import { useNotify } from "@cinatra-ai/sdk-ui";
import { saveGoogleOAuthConnectionAction } from "./actions";
import {
  GoogleOAuthSettingsPanel,
  type GoogleOAuthRejectedInput,
} from "./settings-panel";

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
  // What the operator had typed when a save was REJECTED. React 19 resets a
  // `<form action={…}>` once the action function settles, and this handler
  // settles normally on failure too (it catches, to toast) — so without this the
  // rejected save wipes the fields exactly like the bug this change fixes, only
  // on the path where nothing was stored and retyping is the whole cost.
  // cinatra#2552 removed the common cause (a failed connection-service mirror
  // now degrades instead of throwing), so what remains here is the class where
  // NOTHING persisted: restoring both values is therefore always correct.
  // Cleared the moment a save lands, so it can never shadow stored state.
  //
  // `attempt` counts rejections monotonically. The panel keys the credential
  // fields on it, so two CONSECUTIVE rejections carrying identical values still
  // mount fresh nodes — without it the panel would be back to depending on
  // React's reset ordering in exactly the case this exists to make deterministic.
  const [rejectedInput, setRejectedInput] = useState<GoogleOAuthRejectedInput | null>(null);

  async function handleSubmit(formData: FormData) {
    try {
      const result = await saveGoogleOAuthConnectionAction(formData);
      setRejectedInput(null);
      // cinatra#2552 made a save that persists locally but cannot be mirrored
      // to the connection service DEGRADE (status "incomplete") instead of
      // throwing. A plain success toast would be the only thing the operator
      // sees at that moment, so say what actually happened and point at the
      // panel, which now carries the classified cause and the recourse. The
      // action deliberately returns only this enum — the explanation text is
      // server-rendered, never serialized through the action result.
      if (result?.status === "incomplete") {
        addNotification({
          title: "Google OAuth saved — setup incomplete",
          body: "The client values are stored. The setup panel explains what is still missing.",
          kind: "warning",
        });
        return;
      }
      addNotification({
        title: "Google OAuth connection saved",
        body: "Google OAuth settings have been updated.",
        kind: "success",
      });
    } catch {
      // The action deliberately throws a static connector-owned message (the
      // provider's own text is untrusted and never leaves the server), so there
      // is nothing here worth reading — show the friendly operation-specific
      // copy unconditionally. In a Next.js production build the message would
      // have been replaced by the framework's masking blurb anyway.
      setRejectedInput((previous) => ({
        attempt: (previous?.attempt ?? 0) + 1,
        clientId: String(formData.get("clientId") ?? ""),
        clientSecret: String(formData.get("clientSecret") ?? ""),
      }));
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
      rejectedInput={rejectedInput}
      showConnectionActions={showConnectionActions}
      nangoCallbackUri={nangoCallbackUri}
      betterAuthCallbackUri={betterAuthCallbackUri}
    />
  );
}
