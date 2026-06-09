# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- TypeScript (ES2023 target) - All source files under `src/`

**Secondary:**
- TSX (React JSX) - UI components and setup page (`src/setup-page.tsx`, `src/settings-panel.tsx`, `src/settings-form.tsx`, `src/components/ui/`)

## Runtime

**Environment:**
- Node.js (ESM module system — `"type": "module"` in `package.json`)

**Package Manager:**
- npm (`.npmrc` present — note: contents not read; likely sets registry or auth token)
- Lockfile: Not detected in repository root (node_modules not present)

## Frameworks

**Core:**
- React 19.x (peer dependency) — UI rendering for the operator-facing setup page
- React DOM 19.x (peer dependency) — DOM bindings

**Build/Dev:**
- TypeScript compiler (`tsc`) — `tsconfig.json` targets ES2023, module resolution `bundler`, outputs to `dist/`
- Vitest — test runner (`"test": "vitest"` in `package.json`)

## Key Dependencies

**Critical:**
- `zod` ^4.3.6 — Schema validation for Google OAuth form inputs (`src/actions.ts`)
- `@cinatra-ai/sdk-extensions` (peer, optional) — Provides `requireExtensionAction`, `requireGoogleOAuthConnectionProvider` DI slot, `ExtensionHostContext` type
- `@cinatra-ai/sdk-ui` (peer, optional) — Provides `ConnectorSettingsDialog`, `StatusPill`, `useNotify` components/hooks

**UI Utilities:**
- `class-variance-authority` ^0.7.1 — Component variant construction
- `clsx` ^2.1.1 — Conditional class name composition (`src/lib/utils.ts`)
- `tailwind-merge` ^3.5.0 — Tailwind class merging (`src/lib/utils.ts`)
- `radix-ui` ^1.4.3 — Accessible primitive components (used in `src/components/ui/`)
- `lucide-react` ^1.7.0 — Icon set (`Copy`, `Check` icons in `src/settings-panel.tsx`)

## Configuration

**Environment:**
- `BETTER_AUTH_URL` environment variable — Used in `src/setup-page.tsx` to construct the BetterAuth OAuth callback URI (defaults to `http://localhost:3000`)
- `.npmrc` present — Not read (may contain registry auth tokens)

**Build:**
- `tsconfig.json` — Strict TypeScript, `bundler` module resolution, JSX `react-jsx`, outputs declarations + source maps to `dist/`, no path aliases
- Package exports map in `package.json`:
  - `.` → `src/index.ts`
  - `./setup-page` → `src/setup-page.tsx`
  - `./actions` → `src/actions.ts`

## Cinatra Connector Manifest

Defined in `package.json` under `"cinatra"` key:
- `apiVersion`: `cinatra.ai/v1`
- `kind`: `connector`
- `displayName`: `Google`
- `requestedHostPorts`: `[]` (no host context ports requested)
- `dependencies`: `[]`

## Platform Requirements

**Development:**
- Node.js with ESM support
- Host application must bind the `requireGoogleOAuthConnectionProvider()` DI slot at boot (host-side package `@cinatra-ai/google-oauth-connection`)
- React 19+ host environment

**Production:**
- Deployed as a connector package consumed by the Cinatra host application
- Runtime OAuth logic lives host-side in `@cinatra-ai/google-oauth-connection` (not a dependency of this package)
- Server actions (`src/actions.ts`) require a Next.js-compatible `"use server"` environment

---

*Stack analysis: 2026-06-09*
