"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { StatusPill, type StatusPillStatus } from "@cinatra-ai/sdk-ui";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

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
  showConnectionActions?: boolean;
  nangoCallbackUri?: string;
  betterAuthCallbackUri?: string;
};

// Map the connector's OAuth status to the canonical StatusPill vocabulary
// (design-skill R1 — status flows through StatusPill, never a hand-rolled badge).
const STATUS_PILL: Record<
  GoogleOAuthSettingsPanelProps["status"]["status"],
  { pill: StatusPillStatus; label: string }
> = {
  connected: { pill: "approved", label: "Connected" },
  incomplete: { pill: "needs-review", label: "Setup required" },
  not_connected: { pill: "idle", label: "Not connected" },
};

export function GoogleOAuthSettingsPanel({
  settings,
  status,
  action,
  showConnectionActions = true,
  nangoCallbackUri,
  betterAuthCallbackUri,
}: GoogleOAuthSettingsPanelProps) {
  const [copied, setCopied] = useState(false);
  const callbackUris = [nangoCallbackUri, betterAuthCallbackUri].filter(Boolean) as string[];
  const pill = STATUS_PILL[status.status];

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Google OAuth configuration</h2>
          <p className="mt-3 max-w-[64ch] text-sm leading-[1.55] text-pretty text-muted-foreground">
            Configure the Google OAuth values Cinatra uses to connect Gmail and Google Calendar. Mailbox and calendar access
            require OAuth. API keys can be stored here, but they cannot access a user mailbox or calendar data.
          </p>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
          >
            Get your OAuth client ID &amp; secret in the Google Cloud Console
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
        <StatusPill status={pill.pill}>{pill.label}</StatusPill>
      </div>

      {status.accountEmail ? (
        <div className="mt-5 rounded-control border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Connected Google account: {status.accountEmail}
        </div>
      ) : null}

      {status.detail ? (
        <div className="mt-5 rounded-control border border-line bg-surface-strong px-4 py-3 text-sm text-foreground">{status.detail}</div>
      ) : null}

      <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
        <Label className="grid gap-2">
          OAuth client ID
          <Input name="clientId" defaultValue={settings.clientId ?? ""} />
        </Label>
        <Label className="grid gap-2">
          OAuth client secret
          <Input
            name="clientSecret"
            type="password"
            defaultValue=""
            placeholder={
              settings.clientSecretSet
                ? "•••••••• saved — leave blank to keep"
                : "Enter OAuth client secret"
            }
            autoComplete="off"
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
        <div className="sm:col-span-2 flex flex-wrap gap-3">
          <Button name="intent" value="save">Save Google OAuth</Button>
          {showConnectionActions ? (
            <Button variant="outline" name="intent" value="connect">Connect Google account</Button>
          ) : null}
        </div>
      </form>
      </CardContent>
    </Card>
  );
}
