"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

/**
 * What the operator typed into a save that was REJECTED. Owned here and used by
 * `settings-form.tsx` so the two cannot drift into different shapes.
 */
export type GoogleOAuthRejectedInput = {
  /** Monotonic per rejection — see `fieldGeneration` below. */
  attempt: number;
  clientId: string;
  clientSecret: string;
};

type GoogleOAuthSettingsPanelProps = {
  settings: {
    clientId?: string;
    // Write-only: the secret value never reaches the client; we only know whether
    // one is already stored (to render a "saved" affordance).
    clientSecretSet?: boolean;
  };
  status: {
    status: "connected" | "incomplete" | "not_connected";
    accountEmail?: string;
    detail?: string;
  };
  action: (formData: FormData) => void | Promise<void>;
  /**
   * What the operator typed into a save that was REJECTED, so the form can put
   * it back instead of clearing it. Present only while the last save failed —
   * a rejected save stored NOTHING, so these values shadow nothing.
   */
  rejectedInput?: GoogleOAuthRejectedInput | null;
  showConnectionActions?: boolean;
  nangoCallbackUri?: string;
  betterAuthCallbackUri?: string;
};

export function GoogleOAuthSettingsPanel({
  settings,
  status,
  action,
  rejectedInput = null,
  showConnectionActions = true,
  nangoCallbackUri,
  betterAuthCallbackUri,
}: GoogleOAuthSettingsPanelProps) {
  const [copied, setCopied] = useState(false);
  const callbackUris = [nangoCallbackUri, betterAuthCallbackUri].filter(Boolean) as string[];
  // "Is there a stored OAuth client on this instance?" — a client id alone is
  // enough to have been saved (the secret is write-only and reported only as a
  // boolean), so either half proves a save landed. Read from the SERVER values
  // only: a rejected save must never be able to claim something was stored.
  const savedConfiguration = Boolean(settings.clientId) || Boolean(settings.clientSecretSet);

  // What the two credential fields should hold after the form settles. The
  // stored client id normally; the rejected attempt's own values while a save
  // is being retried. `fieldGeneration` keys both fields so React MOUNTS FRESH
  // nodes whenever that answer changes — see the client-id field below for why
  // updating `defaultValue` alone is not enough.
  const clientIdValue = rejectedInput ? rejectedInput.clientId : settings.clientId ?? "";
  const clientSecretValue = rejectedInput ? rejectedInput.clientSecret : "";
  const fieldGeneration = rejectedInput
    ? `rejected:${rejectedInput.attempt}`
    : `stored:${settings.clientId ?? ""}`;

  // Remounting a field takes its DOM node away, and with it the focus, if the
  // operator submitted with Enter from inside that field. Put focus back —
  // but ONLY when the remount is what dropped it (nothing is focused now), so a
  // save started from the Save button leaves focus on the button.
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastFocusedFieldRef = useRef<string | null>(null);
  const appliedGenerationRef = useRef(fieldGeneration);
  useEffect(() => {
    if (appliedGenerationRef.current === fieldGeneration) return;
    appliedGenerationRef.current = fieldGeneration;
    const name = lastFocusedFieldRef.current;
    if (!name) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const field = formRef.current?.elements.namedItem(name);
    if (!(field instanceof HTMLInputElement)) return;
    // Consumed by THIS remount. Left set, it would let a later remount pull
    // focus into a field the operator had long since clicked away from.
    lastFocusedFieldRef.current = null;
    field.focus();
    // Caret at the end, so a restored value is ready to be edited rather than
    // fully selected. Some engines refuse a range on a password field.
    try {
      field.setSelectionRange(field.value.length, field.value.length);
    } catch {
      /* not selectable — focus alone is the point */
    }
  }, [fieldGeneration]);

  async function handleCopyRedirectUri() {
    try {
      await navigator.clipboard.writeText(callbackUris.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="border-line bg-surface backdrop-blur-none rounded-card">
      <CardContent className="p-6">
      {/* The connection-status badge is HOST-injected on the connector
          setup-page dispatch route — the same badge the /connectors card
          shows — so the extension no longer renders its own status pill here
          (it would duplicate the host badge). The title stays extension-owned;
          the per-account "Connected Google account" line and the status detail
          block below remain. The general config how-to (create an OAuth
          client, where to paste it) now lives in the setup page's Help tab
          (always last, per app-connectors.html §II) instead of duplicating it
          here above the form. */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Google OAuth configuration</h2>
      </div>

      {status.accountEmail ? (
        <div className="mt-5 rounded-control border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Connected Google account: {status.accountEmail}
        </div>
      ) : null}

      {/* Status detail — the DURABLE explanation of the current connection
          state, server-rendered from `getStatus()`. The save action revalidates
          this route, so after a save this block is re-rendered from the stored
          state rather than left holding the pre-save copy
          (google-oauth-connector#57).

          An `incomplete` status is the honest-degradation state cinatra#2552
          introduced: the client values PERSISTED but the connection-service
          mirror did not land, and `detail` carries the classified cause plus
          the recourse. That is not neutral information, so it gets the warning
          treatment instead of the plain surface a `connected` detail gets.

          The wrapper is rendered unconditionally so it is a live region that
          already exists when a save changes its contents; an announcement into
          a region that appears at the same moment is not reliably made. */}
      <div role="status" aria-live="polite">
        {status.detail ? (
          <div
            className={
              status.status === "incomplete"
                ? "mt-5 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
                : "mt-5 rounded-control border border-line bg-surface-strong px-4 py-3 text-sm text-foreground"
            }
          >
            {status.detail}
          </div>
        ) : null}
      </div>

      <form ref={formRef} action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
        <Label className="grid gap-2">
          OAuth client ID
          <Input
            name="clientId"
            // Keyed so a changed value MOUNTS A FRESH NODE. React 19 resets a
            // `<form action={…}>` once the action settles, which restores an
            // uncontrolled input to its `defaultValue`; React updates that
            // property on the live node but never rewrites the node's current
            // value. So if the revalidated tree lands AFTER the reset instead of
            // with it, the operator would still be looking at a blank field
            // holding a correct `defaultValue`. Remounting removes that ordering
            // dependency entirely: the new node is created with the right value.
            key={`clientId:${fieldGeneration}`}
            defaultValue={clientIdValue}
            onFocus={() => {
              lastFocusedFieldRef.current = "clientId";
            }}
          />
        </Label>
        <Label className="grid gap-2">
          OAuth client secret
          <Input
            name="clientSecret"
            type="password"
            // Blank after a save that landed (the stored secret is write-only
            // and a blank submit KEEPS it); the rejected attempt's own value
            // while a save is being retried, so a failure does not cost the
            // operator a re-typed credential. Keyed for the same reason the
            // client-id field is.
            key={`clientSecret:${fieldGeneration}`}
            defaultValue={clientSecretValue}
            placeholder={
              settings.clientSecretSet
                ? "•••••••• saved — leave blank to keep"
                : "Enter OAuth client secret"
            }
            autoComplete="off"
            onFocus={() => {
              lastFocusedFieldRef.current = "clientSecret";
            }}
          />
        </Label>
        {callbackUris.length ? (
          <div className="grid gap-3 text-sm font-medium sm:col-span-2">
            <div>Authorized redirect URIs</div>
            <div className="grid gap-3">
              {nangoCallbackUri ? (
                <Label className="grid gap-2">
                  OAuth redirect URI
                  <Input
                    value={nangoCallbackUri}
                    readOnly
                    className="bg-surface-muted text-foreground"
                  />
                </Label>
              ) : null}
              {betterAuthCallbackUri ? (
                <Label className="grid gap-2">
                  App sign-in callback URI
                  <Input
                    value={betterAuthCallbackUri}
                    readOnly
                    className="bg-surface-muted text-foreground"
                  />
                </Label>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-normal text-muted-foreground">
                Register these exact URIs in Google Cloud. The OAuth redirect URI is derived automatically from Nango.
              </span>
              <div className="flex-1" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyRedirectUri}
                aria-label="Copy authorized redirect URIs"
                title={copied ? "Copied" : "Copy redirect URIs"}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              </Button>
            </div>
            <span className="text-xs font-normal text-muted-foreground">
              {copied ? "Redirect URIs copied to clipboard." : "Copy both values if you want to paste them into Google Cloud at once."}
            </span>
          </div>
        ) : null}
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <Button name="intent" value="save">Save Google OAuth</Button>
          {showConnectionActions ? (
            <Button variant="outline" name="intent" value="connect">Connect Google account</Button>
          ) : null}
          {/* Durable saved-state affordance. The success toast fades after a
              couple of seconds and leaves the panel looking exactly as it did
              before the save; this line does not fade, and it is derived from
              the SERVER-read configuration, so it also states the truth on a
              cold load and after a soft nav — not just right after a save. It
              reports the STORED client values only. Whether those values
              reached the connection service is the host-injected connection
              badge's job, and the detail block above explains a mismatch.

              While a rejected attempt is on screen the fields hold values that
              were NOT stored, so the line describes THEM instead. Reporting
              "Saved" there would be true of the older stored client and false of
              everything the operator is looking at — the precise ambiguity this
              affordance exists to remove. */}
          {rejectedInput ? (
            <span
              data-google-oauth-saved-state="rejected"
              className="text-sm font-medium text-destructive"
            >
              These values are not saved
            </span>
          ) : savedConfiguration ? (
            <span
              data-google-oauth-saved-state="saved"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-success"
            >
              <Check className="h-4 w-4" aria-hidden />
              Saved
            </span>
          ) : (
            <span
              data-google-oauth-saved-state="unsaved"
              className="text-sm text-muted-foreground"
            >
              Not saved yet
            </span>
          )}
        </div>
      </form>
      </CardContent>
    </Card>
  );
}
