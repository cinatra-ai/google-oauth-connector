/**
 * Tab presence / order / content-mapping pins for the spec-driven tabbed
 * setup page (cinatra-ai/google-oauth-connector#43 — connector-setup-tabs).
 *
 * `../setup-page.tsx` composes the shared `@cinatra-ai/sdk-ui/tabs` and
 * `@cinatra-ai/sdk-ui/connector-setup-page` primitives, which this source-mirror
 * connector package does not resolve in isolation (they are optional peers the
 * cinatra monorepo provides/links at build time — see this repo's own
 * `vitest.config.ts` comment and `.github/workflows/ci.yml`, which skips
 * standalone install/typecheck/test for exactly this reason). Matching the
 * established pattern for this class of component in sibling connectors (e.g.
 * google-calendar-connector's `setup-page-review.test.ts`), these pins assert
 * against the authored SOURCE of `../setup-page.tsx` (and `../settings-panel.tsx`
 * for the content-split boundary), rather than attempting a full DOM render
 * that would require re-implementing the primitives under test.
 *
 * The a11y tab *semantics* (roles, aria-selected, keyboard roving focus) are
 * the shared primitive's own contract, already covered by
 * `packages/sdk-ui/src/__tests__/tabs.test.tsx` in the cinatra monorepo — this
 * connector's job is only to prove it COMPOSES that primitive correctly: two
 * tabs, in the right order, Help last, each tab holding the right content.
 * Full visual/keyboard conformance against a booted host is the deferred
 * Playwright render lane (issue #43 acceptance item 3).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const setupPageSrc = readFileSync(
  fileURLToPath(new URL("../setup-page.tsx", import.meta.url)),
  "utf8",
);
const settingsPanelSrc = readFileSync(
  fileURLToPath(new URL("../settings-panel.tsx", import.meta.url)),
  "utf8",
);

// Collapse insignificant JSX whitespace so multi-line elements match as text.
const flatPage = setupPageSrc.replace(/\s+/g, " ");

describe("setup-page — tabbed layout (issue #43)", () => {
  it("imports the shared sdk-ui Tabs primitive, not a vendored copy", () => {
    expect(setupPageSrc).toContain(
      'import { Tabs, TabsContent, TabsListRow, TabsTrigger } from "@cinatra-ai/sdk-ui/tabs";',
    );
    // Boundary-respect: no `tabs.tsx` vendored into this extension anywhere.
    expect(
      existsSync(
        fileURLToPath(new URL("../components/ui/tabs.tsx", import.meta.url)),
      ),
    ).toBe(false);
    expect(
      existsSync(fileURLToPath(new URL("../tabs.tsx", import.meta.url))),
    ).toBe(false);
  });

  it("uses the shared ConnectorSetupPage shell with divider handed to the tab row", () => {
    expect(setupPageSrc).toContain(
      'import { ConnectorSetupPage } from "@cinatra-ai/sdk-ui/connector-setup-page";',
    );
    // divider={false} — TabsListRow owns the etched section rule, so the two
    // rules never stack (app-connectors.html §II).
    expect(flatPage).toContain('<ConnectorSetupPage title="Google OAuth"');
    expect(flatPage).toContain("divider={false}");
  });

  it("declares exactly two tabs: Setup, then Help", () => {
    const triggerValues = [...setupPageSrc.matchAll(/<TabsTrigger value="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(triggerValues).toEqual(["setup", "help"]);
  });

  it("Help is always LAST", () => {
    const setupIdx = setupPageSrc.indexOf('<TabsTrigger value="setup"');
    const helpIdx = setupPageSrc.indexOf('<TabsTrigger value="help"');
    expect(setupIdx).toBeGreaterThan(-1);
    expect(helpIdx).toBeGreaterThan(-1);
    expect(helpIdx).toBeGreaterThan(setupIdx);
  });

  it("the tablist carries an accessible label", () => {
    expect(setupPageSrc).toContain(
      '<TabsListRow aria-label="Google OAuth connector setup">',
    );
  });

  it("Setup tab content maps to the connection/config form (GoogleOAuthSettingsForm), not read-only prose", () => {
    const setupContentMatch = flatPage.match(
      /<TabsContent value="setup"[^>]*>(.*?)<\/TabsContent>/,
    );
    expect(setupContentMatch).not.toBeNull();
    const setupContent = setupContentMatch![1];
    expect(setupContent).toContain("<GoogleOAuthSettingsForm");
    expect(setupContent).not.toContain("Create an OAuth client");
  });

  it("Help tab content maps to read-only setup how-to (no form, no Save)", () => {
    const helpContentMatch = flatPage.match(
      /<TabsContent value="help"[^>]*>(.*?)<\/TabsContent>\s*<\/Tabs>/,
    );
    expect(helpContentMatch).not.toBeNull();
    const helpContent = helpContentMatch![1];
    expect(helpContent).toContain("Create an OAuth client");
    expect(helpContent).toContain("console.cloud.google.com/apis/credentials");
    // Read-only: no form, no Save affordance, no GoogleOAuthSettingsForm.
    expect(helpContent).not.toContain("<form");
    expect(helpContent).not.toContain("<GoogleOAuthSettingsForm");
    expect(helpContent).not.toContain("Save Google OAuth");
  });

  it("Help content narrows to the Narrow (max-w-xl) width per the additional-config-tab treatment", () => {
    const helpOpenTagMatch = flatPage.match(/<TabsContent value="help"[^>]*>/);
    expect(helpOpenTagMatch).not.toBeNull();
    const helpOpenTag = helpOpenTagMatch![0];
    expect(helpOpenTag).toContain("forceMount");
    expect(helpOpenTag).toContain("max-w-xl");
    expect(helpOpenTag).toContain('data-[state=inactive]:hidden');
  });

  it("this connector's single-connection model carries no Connections tab and no multi-instance chrome", () => {
    // Only one connection (a shared admin-level OAuth client config) — the
    // acceptance item requires the RIGHT layout for THIS connector's actual
    // connection model, not a copy-pasted multi-instance shape.
    expect(setupPageSrc).not.toContain('value="connections"');
    expect(setupPageSrc).not.toContain("ConnectorSetupColumns");
  });
});

describe("settings-panel — content moved to Help, not duplicated in Setup", () => {
  it("no longer carries the general config how-to prose (now Help-tab-only)", () => {
    expect(settingsPanelSrc).not.toContain("Create an OAuth client in the");
    expect(settingsPanelSrc).not.toContain("Configure the Google OAuth values");
  });

  it("still owns the form + status affordances (unchanged responsibility)", () => {
    expect(settingsPanelSrc).toContain('name="clientId"');
    expect(settingsPanelSrc).toContain('name="clientSecret"');
    expect(settingsPanelSrc).toContain("Save Google OAuth");
  });
});
