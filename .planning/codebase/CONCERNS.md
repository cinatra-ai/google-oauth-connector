# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

**Hardcoded localhost fallback for betterAuthCallbackUri:**
- Issue: `process.env.BETTER_AUTH_URL ?? "http://localhost:3000"` — if the env var is missing in production, the callback URI shown to operators and copied into Google Cloud will silently be `http://localhost:3000`, which is an invalid redirect URI in a live Google Cloud OAuth client.
- Files: `src/setup-page.tsx` (line 32)
- Impact: Operators configure a wrong redirect URI, breaking sign-in silently. No validation or warning is emitted if the env var is absent.
- Fix approach: Require `BETTER_AUTH_URL` explicitly and throw (or log a visible warning) when it is not set; do not silently fall back to localhost in a server component.

**Duplicated UI component library (vendored shadows of SDK-UI primitives):**
- Issue: `src/components/ui/` contains full implementations of Button, Card, Input, and Label. These are almost certainly duplicated from `@cinatra-ai/sdk-ui`. The `peerDependencies` declares `@cinatra-ai/sdk-ui` but the package never imports from it — all UI primitives are re-implemented locally.
- Files: `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`
- Impact: Style drift between this connector's UI and the host application over time; bug fixes or design tokens applied to sdk-ui don't propagate here automatically.
- Fix approach: Import Button, Card, Input, and Label from `@cinatra-ai/sdk-ui` once the host provides them through the optional peer; remove the local copies.

**`noImplicitAny: false` overrides `strict: true`:**
- Issue: `tsconfig.json` sets `"strict": true` but immediately overrides it with `"noImplicitAny": false`, weakening the type safety guarantee `strict` is meant to provide.
- Files: `tsconfig.json`
- Impact: Implicit `any` types can leak through without compiler errors, defeating strict-mode intent and making future refactors harder to type-check reliably.
- Fix approach: Remove `"noImplicitAny": false` or, if implicit-any is genuinely needed during a migration, add a tracked comment explaining the temporary exception.

**`package.json` `"main"` and `"types"` point to source, not dist:**
- Issue: Both `"main": "src/index.ts"` and `"types": "src/index.ts"` reference the TypeScript source file. The package also has `"outDir": "dist"` in tsconfig but does not expose a `dist/` entry in exports. Conventional npm publishing expects compiled outputs.
- Files: `package.json`, `tsconfig.json`
- Impact: The package works only when consumed inside the monorepo workspace (which resolves TS sources via its own tsconfig paths). If ever published standalone, consumers will receive TypeScript source rather than compiled JavaScript.
- Fix approach: Update `"main"`, `"types"`, and `"exports"` to point to `dist/` outputs after compilation, or document explicitly that this is a workspace-only source mirror that is never published independently.

## Known Bugs

**`clientSecret` field defaults to empty string, but `z.string().optional()` allows empty string through:**
- Symptoms: If an operator submits the form with an empty `clientSecret` input, the schema parses `""` as a valid optional string and passes it to `saveSettings`. The host `saveSettings` then must implement its own "blank means keep" logic — if the host implementation changes that contract, blank submissions will overwrite the stored secret with an empty string.
- Files: `src/actions.ts`
- Trigger: Submit the setup form without entering a client secret when one is already saved.
- Workaround: The comments note the host honours "blank = keep", but there is no assertion or guard in the connector itself.

## Security Considerations

**`clientId` is pre-filled and sent to the client:**
- Risk: The setup-page comment notes `clientId` is "not secret (it appears in the OAuth authorization URL the browser already sees)" — this is accurate for standard OAuth, but confirms the design choice. No concern here beyond documentation accuracy.
- Files: `src/setup-page.tsx`
- Current mitigation: `clientSecret` is correctly write-only: the form never receives the secret value, only a boolean `clientSecretSet` flag.
- Recommendations: Acceptable as-is. Document the distinction clearly in the `GoogleOAuthSettingsPanelProps` type comment (currently only in setup-page.tsx comment).

**DI slot fails closed but failure mode is an unhandled exception:**
- Risk: `requireGoogleOAuthConnectionProvider()` throws if the host never bound the DI slot. The setup-page relies on the `ConnectorSettingsDialog` error boundary catching this throw. If the host renders the page outside an error boundary, the exception surfaces as an unhandled server error with no operator-friendly message.
- Files: `src/setup-page.tsx`
- Current mitigation: The comment documents this as intentional fail-closed behavior surfaced by an error boundary.
- Recommendations: Add a human-readable catch in the setup page that re-throws a message like "Google OAuth provider not registered — check host boot configuration."

## Performance Bottlenecks

**Parallel `Promise.all` for settings and status fetch:**
- Problem: Not a bottleneck — `Promise.all([facade.getSettings(), facade.getStatus()])` is already the correct pattern.
- Files: `src/setup-page.tsx`
- Cause: Not applicable.
- Improvement path: Not applicable.

## Fragile Areas

**DI provider coupling between this connector and the host:**
- Files: `src/setup-page.tsx`, `src/actions.ts`
- Why fragile: The entire connector depends on `requireGoogleOAuthConnectionProvider()` being wired by the host at boot. There is no local fallback, stub, or mock. If the host registration call (`setGoogleOAuthConnectionProvider`) is removed, renamed, or executed after the connector renders, the connector breaks completely with no graceful degradation.
- Safe modification: Always update the host registration (`src/lib/register-google-oauth-provider.ts` in the host) and the connector's `requireGoogleOAuthConnectionProvider()` call together.
- Test coverage: No tests exist for this connector (see Test Coverage Gaps below); the DI binding is completely untested in isolation.

**`showConnectionActions` prop is silently unused in the production path:**
- Files: `src/setup-page.tsx`, `src/settings-form.tsx`, `src/settings-panel.tsx`
- Why fragile: The setup page always passes `showConnectionActions={false}` but the prop flows through two component layers. Any future developer adding connection-action UI must trace this prop chain, and it is easy to accidentally enable the button in the wrong render context.
- Safe modification: If connection actions remain permanently hidden in this connector, remove the prop and simplify the component chain.

## Scaling Limits

**Single shared OAuth client for all Google services:**
- Current capacity: One Google Cloud project client ID / secret shared across Gmail, Calendar, and YouTube.
- Limit: If Google tightens scope restrictions (per-service OAuth clients become required) or if different services need different consent screens, the shared-credential model breaks without a connector redesign.
- Scaling path: The settings schema (`googleOAuthConnectorSchema`) would need to support multiple credential sets; the current schema supports only one `clientId` / `clientSecret` pair.

## Dependencies at Risk

**`lucide-react ^1.7.0` — major version with significant icon API changes:**
- Risk: v1.x of lucide-react introduced breaking icon renames vs 0.x. If the monorepo pins a different major version, icon imports (`Check`, `Copy`) could mismatch.
- Impact: Build-time import errors or missing icons at runtime.
- Migration plan: Pin to the same version used by the host monorepo; avoid wide semver ranges like `^1.x` for icon libraries with frequent renames.

**`zod ^4.3.6` — zod v4 is a significant breaking change from v3:**
- Risk: `zod` v4 changed the API in ways incompatible with v3 consumers. If the host or other packages depend on zod v3, dual-version resolution can cause type mismatches.
- Impact: `z.object().parse()` may throw differently in v4; error message formats changed.
- Migration plan: Ensure the entire monorepo is aligned on zod v4; do not mix zod v3 and v4 across packages.

**`radix-ui ^1.4.3` — unified package instead of scoped `@radix-ui/*`:**
- Risk: The connector imports from the `radix-ui` umbrella package (`Slot`, `Label`) rather than individual `@radix-ui/react-*` scoped packages. If the host uses the scoped packages, there could be duplicate Radix context providers in the component tree.
- Impact: Potential context isolation bugs for Radix primitives (e.g., tooltip, dialog state shared incorrectly).
- Migration plan: Align on either the umbrella `radix-ui` or the scoped `@radix-ui/*` packages consistently across the monorepo.

## Missing Critical Features

**No input validation on `clientId` format:**
- Problem: The `clientId` field accepts any string. Google OAuth client IDs follow a specific format (`*.apps.googleusercontent.com`). An operator entering a wrong value gets no feedback until runtime OAuth fails.
- Blocks: Operator self-service troubleshooting; the setup form provides no guard against obviously wrong values.

**No vitest configuration file:**
- Problem: `package.json` declares `"test": "vitest"` but there is no `vitest.config.*` file in the repo. Vitest will run with defaults, which may not match the host's test configuration (transform settings, jsdom vs node environment, etc.).
- Blocks: Any test written for this connector may behave differently than tests in the monorepo.

## Test Coverage Gaps

**Zero test files exist:**
- What's not tested: All functionality — the `saveGoogleOAuthConnectionAction` server action, the DI slot resolution, form submission handling, error notification behavior, and the status → StatusPill mapping.
- Files: `src/actions.ts`, `src/setup-page.tsx`, `src/settings-form.tsx`, `src/settings-panel.tsx`
- Risk: Regressions in the save action (e.g., schema changes, error re-throw logic), DI boot-wiring bugs, or UI state bugs (e.g., the "copied" clipboard state) go undetected.
- Priority: High — the `saveGoogleOAuthConnectionAction` handles credential writes and should have at minimum unit tests for schema parsing and error propagation.

---

*Concerns audit: 2026-06-09*
