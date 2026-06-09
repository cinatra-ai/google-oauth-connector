<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│              HOST (Next.js app — separate repo)              │
│  registers DI slot: setGoogleOAuthConnectionProvider()       │
│  binds: @cinatra-ai/google-oauth-connection (host-side pkg)  │
└──────────────────────────┬──────────────────────────────────┘
                           │ DI slot injection at boot
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           @cinatra-ai/google-oauth-connector (this pkg)      │
├─────────────────┬──────────────────┬────────────────────────┤
│  setup-page     │  settings-form   │  actions               │
│ (RSC, server)   │  (client comp)   │  (server action)       │
│ `src/setup-     │  `src/settings-  │  `src/actions.ts`      │
│  page.tsx`      │   form.tsx`      │                        │
└────────┬────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              UI Layer — in-package primitives                │
│  `src/settings-panel.tsx`  `src/components/ui/`              │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  SDK Peer Dependencies (host-supplied at runtime)            │
│  @cinatra-ai/sdk-extensions   @cinatra-ai/sdk-ui             │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Package manifest | Exports `googleOAuthConnectorPackage` definition consumed by the host registry | `src/index.ts` |
| Setup page | RSC entry point — resolves DI facade, fetches settings/status, renders dialog | `src/setup-page.tsx` |
| Settings form | Client component — wires form submission to server action, shows notifications | `src/settings-form.tsx` |
| Settings panel | Pure UI — renders credential inputs, redirect URIs, copy button, status pill | `src/settings-panel.tsx` |
| Save action | Server action — authorizes via SDK, validates schema, delegates to DI provider | `src/actions.ts` |
| UI primitives | In-package shadcn-style Button, Card, Input, Label | `src/components/ui/` |
| Utils | `cn()` helper — merges Tailwind classes | `src/lib/utils.ts` |

## Pattern Overview

**Overall:** Cinatra SDK connector — operator-facing React Server Component setup page with a matching server action, both decoupled from the host runtime via a host-injected DI slot (`requireGoogleOAuthConnectionProvider()`).

**Key Characteristics:**
- Zero host runtime imports — the connector never imports `@cinatra-ai/google-oauth-connection` directly
- Single DI contract (`requireGoogleOAuthConnectionProvider`) shared by both the RSC render and the server action
- Authority gate via `requireExtensionAction(pkg, "manage")` instead of host session helpers
- Secret write-only contract: `clientSecret` never flows to the client; only `clientSecretSet: boolean` does
- No host ctx ports requested (`requestedHostPorts: []` in `package.json`)

## Layers

**Package Registration Layer:**
- Purpose: Declare the connector identity to the host's extension registry
- Location: `src/index.ts`
- Contains: `HostRequiredPackageDefinition` export
- Depends on: `@cinatra-ai/sdk-extensions` types only
- Used by: Host app extension loader at boot

**Server (RSC) Layer:**
- Purpose: Fetch settings and connection status from the host DI facade; render the operator setup dialog
- Location: `src/setup-page.tsx`
- Contains: Async RSC default export
- Depends on: `requireGoogleOAuthConnectionProvider()`, `@cinatra-ai/sdk-ui` (ConnectorSettingsDialog)
- Used by: Host routing — mounted at `/connectors/cinatra-ai/google-oauth-connector/setup`

**Server Action Layer:**
- Purpose: Validate and persist Google OAuth credentials via the host DI facade
- Location: `src/actions.ts`
- Contains: `saveGoogleOAuthConnectionAction` (Next.js `"use server"` action)
- Depends on: `requireExtensionAction`, `requireGoogleOAuthConnectionProvider`, `zod`
- Used by: `src/settings-form.tsx` (client side form submit)

**Client UI Layer:**
- Purpose: Interactive form shell — submits FormData, handles success/error notifications
- Location: `src/settings-form.tsx`
- Contains: `"use client"` component `GoogleOAuthSettingsForm`
- Depends on: `saveGoogleOAuthConnectionAction`, `useNotify` (sdk-ui), `GoogleOAuthSettingsPanel`
- Used by: `src/setup-page.tsx`

**Presentation Layer:**
- Purpose: Stateless(-ish) UI — inputs, status pill, redirect URI copy, save button
- Location: `src/settings-panel.tsx`
- Contains: `"use client"` component `GoogleOAuthSettingsPanel`, clipboard copy logic
- Depends on: `src/components/ui/`, `@cinatra-ai/sdk-ui` (StatusPill)
- Used by: `src/settings-form.tsx`

**Primitive UI Layer:**
- Purpose: Low-level shadcn-style components scoped to this package
- Location: `src/components/ui/`
- Contains: Button (`button.tsx`), Card + CardContent (`card.tsx`), Input (`input.tsx`), Label (`label.tsx`)
- Depends on: `src/lib/utils.ts`, `class-variance-authority`, `radix-ui`, `lucide-react`
- Used by: `src/settings-panel.tsx`

## Data Flow

### Setup Page Render (operator opens /connectors/.../setup)

1. Host routes request to `GoogleOAuthConnectorSetupPage` (`src/setup-page.tsx`)
2. RSC calls `requireGoogleOAuthConnectionProvider()` to get host-bound facade
3. Parallel fetch: `facade.getSettings()` + `facade.getStatus()` + `facade.getOAuthCallbackUrl()`
4. `clientSecret` stripped to `clientSecretSet: boolean` — secret never serialised to client
5. `ConnectorSettingsDialog` (sdk-ui) wraps `GoogleOAuthSettingsForm` (client component) with hydrated props

### Save Credentials (operator submits form)

1. `GoogleOAuthSettingsForm.handleSubmit` invoked with `FormData` (`src/settings-form.tsx`)
2. `saveGoogleOAuthConnectionAction(formData)` called (server action, `src/actions.ts`)
3. `requireExtensionAction("@cinatra-ai/google-oauth-connector", "manage")` — fails closed if unauthorized
4. Zod schema parses `clientId` / `clientSecret` from FormData (both optional)
5. `requireGoogleOAuthConnectionProvider().saveSettings(...)` delegates to host DI implementation
6. Success → `useNotify` success toast; error → error toast (client-side)

**State Management:**
- No client-side global state. Form is uncontrolled (native FormData). Notification state via `useNotify` (sdk-ui). Copy-button flash state via local `useState` in `GoogleOAuthSettingsPanel`.

## Key Abstractions

**`requireGoogleOAuthConnectionProvider()` (SDK DI slot):**
- Purpose: Host-injected facade providing `getSettings()`, `getStatus()`, `getOAuthCallbackUrl()`, `saveSettings()`
- Imported from: `@cinatra-ai/sdk-extensions`
- Used by: `src/setup-page.tsx` (render), `src/actions.ts` (save)

**`HostRequiredPackageDefinition`:**
- Purpose: Typed manifest struct the host extension registry reads to register connectors
- Exported at: `src/index.ts` as `googleOAuthConnectorPackage`

**`googleOAuthConnectorSchema` (Zod):**
- Purpose: Validates FormData fields before delegating to the DI facade
- Location: `src/actions.ts` (module-local, not exported)

## Entry Points

**Package root:**
- Location: `src/index.ts`
- Triggers: Host extension registry import
- Responsibilities: Exports connector identity (`googleOAuthConnectorPackage`)

**Setup page:**
- Location: `src/setup-page.tsx` (exported as `"./setup-page"` in `package.json`)
- Triggers: Host router mounts it at the `settingsHref` path
- Responsibilities: Full RSC render of the operator setup dialog

**Server action:**
- Location: `src/actions.ts` (exported as `"./actions"` in `package.json`)
- Triggers: Client form submit via `saveGoogleOAuthConnectionAction`
- Responsibilities: Auth gate, validation, credential persistence

## Architectural Constraints

- **No host runtime imports:** The connector MUST NOT import `@cinatra-ai/google-oauth-connection`. All runtime OAuth logic is host-side and reached only via the `requireGoogleOAuthConnectionProvider()` DI slot.
- **Secret write-only:** `clientSecret` must never be serialized to the client bundle or RSC props. Only `clientSecretSet: boolean` may cross the server/client boundary.
- **Authority:** Use `requireExtensionAction(pkg, "manage")` for the save action — never import host session helpers (`@/lib/auth-session` etc.).
- **No ctx ports:** `requestedHostPorts: []` — the connector requests no host capability ports.
- **Global state:** None. No module-level singletons in this package.
- **Circular imports:** None detected.

## Anti-Patterns

### Importing host runtime directly

**What happens:** Importing `@cinatra-ai/google-oauth-connection` from inside this package
**Why it's wrong:** Creates a hard coupling to the host runtime, breaks SDK-only decoupling, and would make the connector unusable outside the host
**Do this instead:** Call `requireGoogleOAuthConnectionProvider()` from `@cinatra-ai/sdk-extensions` — it resolves the host-bound implementation at runtime (`src/actions.ts` and `src/setup-page.tsx` show the correct pattern)

### Sending client secret to the browser

**What happens:** Passing `settings.clientSecret` as a prop to any client component
**Why it's wrong:** Leaks a sensitive credential to the client bundle and over the network
**Do this instead:** Derive `clientSecretSet: Boolean(settings.clientSecret)` server-side and pass only the boolean, as done in `src/setup-page.tsx` line 40

## Error Handling

**Strategy:** Fail-closed — any DI slot call that throws propagates up; `setup-page.tsx` relies on `ConnectorSettingsDialog`'s error boundary; `actions.ts` catches provider errors and re-throws with a user-readable message.

**Patterns:**
- Server action wraps `saveSettings` in try/catch, re-throws `new Error(message)` for the client
- Client form catches action errors and surfaces them via `useNotify` error toast (`src/settings-form.tsx`)
- DI slot (`requireGoogleOAuthConnectionProvider()`) throws if host never wired it — surfaces at render time via dialog error boundary

## Cross-Cutting Concerns

**Logging:** Not applicable — no logging infrastructure in this package. Errors bubble to host.
**Validation:** Zod schema in `src/actions.ts` validates form fields before delegation.
**Authentication:** `requireExtensionAction` from `@cinatra-ai/sdk-extensions` enforces `manage` permission on this connector.

---

*Architecture analysis: 2026-06-09*
