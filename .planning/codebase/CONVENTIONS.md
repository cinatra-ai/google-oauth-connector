# Coding Conventions

**Analysis Date:** 2026-06-09

## Naming Patterns

**Files:**
- React component files use PascalCase-ish kebab: `settings-form.tsx`, `settings-panel.tsx`, `setup-page.tsx`
- UI primitive files use kebab-case: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`
- Utility modules use kebab-case: `src/lib/utils.ts`
- Server actions use kebab-case: `src/actions.ts`
- Barrel/entry point: `src/index.ts`

**Functions:**
- Exported React components use PascalCase: `GoogleOAuthSettingsForm`, `GoogleOAuthSettingsPanel`, `Button`, `Input`
- Server actions use camelCase with `Action` suffix: `saveGoogleOAuthConnectionAction`
- Event handlers use camelCase with `handle` prefix: `handleSubmit`, `handleCopyRedirectUri`
- Utility functions use camelCase: `cn` (classname merger in `src/lib/utils.ts`)

**Variables:**
- camelCase throughout: `clientId`, `clientSecretSet`, `nangoCallbackUri`, `betterAuthCallbackUri`
- SCREAMING_SNAKE_CASE for module-level lookup constants: `STATUS_PILL` in `src/settings-panel.tsx`

**Types:**
- PascalCase with descriptive `Props` suffix for component prop types: `GoogleOAuthSettingsFormProps`, `GoogleOAuthSettingsPanelProps`, `ConnectorSetupPageProps`
- Zod schema variables use camelCase with `Schema` suffix: `googleOAuthConnectorSchema`
- CVA variant definitions use camelCase with `Variants` suffix: `buttonVariants`

## Code Style

**Formatting:**
- No Prettier or ESLint config detected at repo root. Style is enforced by the monorepo when this source mirror is consumed there.
- Indentation: 2 spaces
- Strings: double quotes in JSX props and TypeScript; single-quote absence is consistent
- Trailing commas present on multi-line destructures and object literals

**Linting:**
- No local `.eslintrc*`, `eslint.config.*`, or `biome.json` detected. Lint enforcement delegated to the host monorepo.

**TypeScript:**
- `strict: true`, `noImplicitAny: false` — strict null checks apply but implicit any is allowed
- `verbatimModuleSyntax: true` — import type must use `import type` syntax (see `src/index.ts`)
- `isolatedModules: true` — every file must be a module
- Target ES2023, module ESNext, `moduleResolution: bundler`

## Import Organization

**Order observed:**
1. External/third-party packages (`react`, `zod`, `lucide-react`, `class-variance-authority`, `radix-ui`)
2. Internal SDK packages (`@cinatra-ai/sdk-extensions`, `@cinatra-ai/sdk-ui`)
3. Local relative imports (`./actions`, `./settings-panel`, `../../lib/utils`)

**Path Aliases:**
- None — all internal imports use relative paths (`./`, `../../`)

**`import type` usage:**
- Type-only imports use `import type` consistently, enforced by `verbatimModuleSyntax: true` (e.g., `import type { HostRequiredPackageDefinition }` in `src/index.ts`)

## Error Handling

**Patterns:**
- Server actions (`src/actions.ts`) wrap provider calls in `try/catch` and re-throw as `new Error(message)` with a safe user-facing message extracted from `error instanceof Error ? error.message : "<fallback>"`
- UI form handlers (`src/settings-form.tsx`) catch errors from server actions and surface them via `addNotification` (toast system from `@cinatra-ai/sdk-ui`) — errors never propagate to React error boundaries from form submissions
- Clipboard errors in `src/settings-panel.tsx` are silently swallowed (`catch { setCopied(false) }`) — no user-visible error for clipboard failure
- DI slot failures (e.g., `requireGoogleOAuthConnectionProvider()` not bound) surface as thrown errors, expected to be caught by the host's error boundary

## Logging

**Framework:** None — no logging library detected.

**Patterns:**
- No explicit `console.log` / `console.error` calls in source files. Errors propagate via thrown exceptions or notification toasts.

## Comments

**When to Comment:**
- Block comments at the top of each module explain the architectural context, DI wiring, and security rationale (see `src/index.ts`, `src/actions.ts`, `src/setup-page.tsx`)
- Inline comments annotate security-sensitive decisions: write-only secret handling in `src/settings-panel.tsx` and `src/settings-form.tsx`
- CVA variant comments explain design-system rationale (e.g., `// Primary button strokes use --line-strong`)

**JSDoc/TSDoc:**
- Not used. Inline comments and type signatures serve as documentation.

## Function Design

**Size:** Functions are small and focused. Event handlers are defined as named `async function` declarations inside components (not arrow functions assigned to `const`).

**Parameters:** Components receive a single typed props object. Utility functions (`cn`) use rest parameters.

**Return Values:** Components return JSX. Server actions are `async` and return `void` (or throw on error). Non-async utilities return computed values directly.

## Module Design

**Exports:**
- Named exports for all components and utilities: `export function`, `export const`, `export { Button, buttonVariants }`
- Default export used only for the async page component (`src/setup-page.tsx`): `export default async function GoogleOAuthConnectorSetupPage`
- Package entry points declared in `package.json` `exports` field: `.` → `src/index.ts`, `./setup-page` → `src/setup-page.tsx`, `./actions` → `src/actions.ts`

**Barrel Files:**
- `src/index.ts` is the main barrel, exporting only the package definition constant (not re-exporting components — consumers import components via the named export paths)
- `src/components/ui/` components are not re-exported through a barrel; consumers import each directly

## Directive Conventions

- `"use server"` placed at the top of `src/actions.ts` (Next.js server action boundary)
- `"use client"` placed at the top of `src/settings-form.tsx` and `src/settings-panel.tsx` (React client component boundary)
- Page component (`src/setup-page.tsx`) has no directive — it is an async server component by default

---

*Convention analysis: 2026-06-09*
