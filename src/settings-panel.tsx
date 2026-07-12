"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
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
