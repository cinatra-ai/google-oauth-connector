# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
google-oauth-connector/
├── src/
│   ├── index.ts                  # Package root export — connector manifest
│   ├── setup-page.tsx            # RSC setup page (exported as "./setup-page")
│   ├── settings-form.tsx         # Client form shell (wires action + notifications)
│   ├── settings-panel.tsx        # Stateless-ish UI panel (inputs, status, copy)
│   ├── actions.ts                # Server action for saving credentials
│   ├── components/
│   │   └── ui/
│   │       ├── button.tsx        # CVA-based Button primitive
│   │       ├── card.tsx          # Card + CardContent primitive
│   │       ├── input.tsx         # Input primitive
│   │       └── label.tsx         # Label primitive
│   └── lib/
│       └── utils.ts              # cn() Tailwind class merge helper
├── .github/
│   └── workflows/
│       ├── ci.yml                # CI pipeline
│       └── release.yml           # Release pipeline
├── package.json                  # Package manifest + cinatra connector metadata
├── tsconfig.json                 # TypeScript config
├── .npmrc                        # npm registry config
└── LICENSE                       # Apache-2.0
```

## Directory Purposes

**`src/`:**
- Purpose: All TypeScript/TSX source for the connector
- Contains: RSC page, client components, server action, UI primitives, utilities
- Key files: `src/index.ts`, `src/setup-page.tsx`, `src/actions.ts`

**`src/components/ui/`:**
- Purpose: In-package shadcn-style primitive components (not imported from sdk-ui)
- Contains: Button, Card, Input, Label — each self-contained
- Key files: `src/components/ui/button.tsx`

**`src/lib/`:**
- Purpose: Shared utility functions used across components
- Contains: `utils.ts` (only file) — exports `cn()` for Tailwind class merging

**`.github/workflows/`:**
- Purpose: CI and release automation
- Contains: `ci.yml`, `release.yml`

## Key File Locations

**Entry Points:**
- `src/index.ts`: Package root — exports `googleOAuthConnectorPackage` (HostRequiredPackageDefinition)
- `src/setup-page.tsx`: Operator setup RSC — default export, mounted by host router
- `src/actions.ts`: Server action — exports `saveGoogleOAuthConnectionAction`

**Configuration:**
- `package.json`: Declares `cinatra` manifest block (`kind: connector`, `requestedHostPorts: []`), package exports, peer dependencies
- `tsconfig.json`: TypeScript compiler settings
- `.npmrc`: Registry configuration (existence noted; contents not read)

**Core Logic:**
- `src/actions.ts`: Auth gating, Zod validation, DI facade delegation
- `src/setup-page.tsx`: Settings/status fetch, secret-stripping, dialog render

**UI:**
- `src/settings-panel.tsx`: Full operator UI — credential inputs, redirect URIs, status pill
- `src/settings-form.tsx`: Thin client wrapper — ties panel to server action + notifications

**Utilities:**
- `src/lib/utils.ts`: `cn()` helper

## Naming Conventions

**Files:**
- Kebab-case for all files: `setup-page.tsx`, `settings-form.tsx`, `settings-panel.tsx`
- Component files use `.tsx`; pure logic files use `.ts`
- UI primitives match shadcn naming: `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`

**Directories:**
- Lowercase kebab-case: `components/`, `ui/`, `lib/`

**Exports:**
- Named exports for components: `export function GoogleOAuthSettingsForm`
- Default export only for the RSC page: `export default async function GoogleOAuthConnectorSetupPage`
- Named const for package manifest: `export const googleOAuthConnectorPackage`

**Types:**
- Props types are co-located, inline, prefixed with component name: `GoogleOAuthSettingsPanelProps`, `GoogleOAuthSettingsFormProps`

## Where to Add New Code

**New server-side data fetching (additional facade calls):**
- Add to `src/setup-page.tsx` — fetch in the RSC, pass down as props

**New form fields (additional credentials):**
- Add to Zod schema in `src/actions.ts`
- Add inputs to `src/settings-panel.tsx`
- Extend `GoogleOAuthSettingsPanelProps` and `GoogleOAuthSettingsFormProps` type shapes

**New UI primitives:**
- Add to `src/components/ui/` following the existing shadcn pattern (CVA variants, `cn()` helper, named export)

**New utility functions:**
- Add to `src/lib/utils.ts` (small utils) or create a new file under `src/lib/` for larger concerns

**Tests:**
- No test files detected in the repo. If added, co-locate with source or place under a `__tests__/` directory. Test runner is `vitest` (configured in `package.json` scripts).

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents
- Generated: Yes (by gsd-map-codebase)
- Committed: Per project convention

**`.github/workflows/`:**
- Purpose: CI/CD automation
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-06-09*
