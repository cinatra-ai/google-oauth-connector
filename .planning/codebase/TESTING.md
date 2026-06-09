# Testing Patterns

**Analysis Date:** 2026-06-09

## Test Framework

**Runner:**
- Vitest (configured via `package.json` `scripts.test: "vitest"`)
- No `vitest.config.*` file detected at repo root — Vitest runs with default configuration
- No `jest.config.*` detected

**Assertion Library:**
- Vitest built-in (expect/vi)

**Run Commands:**
```bash
pnpm test          # Run all tests (vitest)
pnpm test --watch  # Watch mode (vitest default in dev)
```

## Test File Organization

**Location:**
- No test files (`*.test.*` or `*.spec.*`) exist in this repo at the time of analysis.

**Naming:**
- Convention not established — no examples present.

**Structure:**
- Not applicable — no tests present.

## Test Structure

**Suite Organization:**
- Not applicable — no tests present.

**Patterns:**
- Not applicable — no tests present.

## Mocking

**Framework:** Not applicable — no tests present.

**What to Mock (based on architecture):**
- `requireGoogleOAuthConnectionProvider()` from `@cinatra-ai/sdk-extensions` — the DI slot must be mocked in unit tests for `src/actions.ts` and `src/setup-page.tsx`
- `requireExtensionAction()` from `@cinatra-ai/sdk-extensions` — the auth gate must be mocked to test both authorized and unauthorized paths in `src/actions.ts`
- `useNotify()` from `@cinatra-ai/sdk-ui` — the toast hook must be mocked to test notification calls in `src/settings-form.tsx`
- `navigator.clipboard` — the Web API must be mocked to test copy-to-clipboard in `src/settings-panel.tsx`

**What NOT to Mock:**
- `cn()` from `src/lib/utils.ts` — pure utility, test with real implementation
- `zod` schema parsing in `src/actions.ts` — test with real zod to catch schema regressions

## Fixtures and Factories

**Test Data:**
- Not applicable — no tests or fixture files present.

**Location:**
- No fixtures directory established.

## Coverage

**Requirements:** Not enforced — no coverage config in `package.json` or `vitest.config.*`.

**View Coverage:**
```bash
pnpm test --coverage
```

## Test Types

**Unit Tests:**
- Not present. Intended scope would be: `src/actions.ts` server action (mocking the DI provider and auth gate), `src/lib/utils.ts` `cn()` helper, Zod schema validation in `src/actions.ts`.

**Integration Tests:**
- Not present. Would cover form submission flow from `GoogleOAuthSettingsForm` through `saveGoogleOAuthConnectionAction`.

**E2E Tests:**
- Not applicable — this is a source-mirror connector package; E2E testing is the responsibility of the host monorepo.

## CI Testing Behavior

The CI pipeline (`.github/workflows/ci.yml`) classifies the repo as a **source mirror** because it declares host-internal `@cinatra-ai/*` packages as optional peer dependencies. As a result:

- `pnpm install` is **skipped** in CI — the monorepo resolves peers at build time
- `pnpm test` is **skipped** in CI for this repo — the monorepo runs tests against the resolved workspace
- TypeScript typecheck is **skipped** in CI for the same reason
- Only `npm pack --dry-run` (package shape validation) runs standalone

This means test execution for this package occurs only when it is consumed inside the Cinatra monorepo workspace, not in this standalone repo's CI.

## Common Patterns

**Async Testing:**
- Not established — no examples present. Given the server actions are async, use `await` with Vitest's async test support.

**Error Testing:**
- Not established. `saveGoogleOAuthConnectionAction` in `src/actions.ts` throws `new Error(message)` on provider failure — test by mocking the provider's `saveSettings` to reject.

---

*Testing analysis: 2026-06-09*
