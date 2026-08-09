/**
 * Post-save refresh contract for `saveGoogleOAuthConnectionAction`
 * (google-oauth-connector#57).
 *
 * The reported defect: a successful save toasts, the form fields go empty, and
 * nothing on the page says a configuration is stored. The save itself was
 * always fine — navigating back to the page showed the saved values — so the
 * missing piece is the REFRESH. The action never revalidated its own route, so
 * the RSC tree the browser holds stayed the pre-save one and React 19's
 * post-action `<form>` reset restored the client-id input to a stale empty
 * `defaultValue`.
 *
 * These pins cover the action's half of the fix:
 *   - the setup route (and the connectors grid that renders the same status) is
 *     revalidated after — and only after — the save lands;
 *   - the revalidated path is the SAME literal `./index.ts` publishes as
 *     `settingsHref`, so a future route rename cannot leave a revalidate
 *     pointing at a path that no longer exists;
 *   - the status is read BACK through the host facade so the caller can tell a
 *     clean save from the cinatra#2552 degraded one, and a read-back failure
 *     never turns a landed save into a reported failure;
 *   - no secret and no provider-supplied text rides out on the result.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn((_path: string) => {});
const requireExtensionAction = vi.fn(async (_packageId: string, _action: string) => {});

type Provider = {
  getSettings: ReturnType<typeof vi.fn>;
  getStatus: ReturnType<typeof vi.fn>;
  getOAuthCallbackUrl: ReturnType<typeof vi.fn>;
  saveSettings: ReturnType<typeof vi.fn>;
};

let provider: Provider;

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

vi.mock("@cinatra-ai/sdk-extensions", () => ({
  requireExtensionAction: (packageId: string, action: string) =>
    requireExtensionAction(packageId, action),
  requireGoogleOAuthConnectionProvider: () => provider,
}));

import { saveGoogleOAuthConnectionAction } from "../actions";

const SETUP_PATH = "/connectors/cinatra-ai/google-oauth-connector/setup";

function formDataOf(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

function stubProvider(over: Partial<Provider> = {}): Provider {
  return {
    getSettings: vi.fn(async () => ({ clientId: "stored-client-id", clientSecret: "stored-secret" })),
    getStatus: vi.fn(async () => ({ status: "connected" as const, detail: "Google OAuth is configured for Cinatra." })),
    getOAuthCallbackUrl: vi.fn(() => "https://nango.example/oauth/callback"),
    saveSettings: vi.fn(async () => ({ clientId: "stored-client-id", clientSecret: "stored-secret" })),
    ...over,
  } as Provider;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  provider = stubProvider();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("saveGoogleOAuthConnectionAction — post-save refresh (#57)", () => {
  it("revalidates the connector setup route after the save lands", async () => {
    await saveGoogleOAuthConnectionAction(formDataOf({ clientId: "abc.apps.googleusercontent.com", clientSecret: "s3cret" }));

    expect(provider.saveSettings).toHaveBeenCalledWith({
      clientId: "abc.apps.googleusercontent.com",
      clientSecret: "s3cret",
    });
    expect(revalidatePath).toHaveBeenCalledWith(SETUP_PATH);
  });

  it("also revalidates the connectors grid, which renders the same connection status", async () => {
    await saveGoogleOAuthConnectionAction(formDataOf({ clientId: "abc" }));
    expect(revalidatePath).toHaveBeenCalledWith("/connectors");
  });

  it("revalidates AFTER the save, never on a save that threw", async () => {
    provider = stubProvider({
      saveSettings: vi.fn(async () => {
        throw new Error("write failed");
      }),
    });

    await expect(
      saveGoogleOAuthConnectionAction(formDataOf({ clientId: "abc" })),
    ).rejects.toThrow();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("re-throws connector-owned copy, never the provider's own error text", async () => {
    // `saveSettings` reaches the connection service, so its message is
    // untrusted (an HTTP error body can echo back what was sent). Next.js masks
    // a thrown Server Action message only in a PRODUCTION build — a dev build
    // serializes the real one to the browser — so it must never be the
    // provider's to begin with.
    provider = stubProvider({
      saveSettings: vi.fn(async () => {
        throw new Error('Request failed with status code 401: {"sent":{"client_secret":"s3cret"}}');
      }),
    });

    const thrown = await saveGoogleOAuthConnectionAction(
      formDataOf({ clientId: "abc", clientSecret: "s3cret" }),
    ).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("Unable to save the Google OAuth connection.");
    expect((thrown as Error).message).not.toContain("s3cret");
    expect((thrown as Error).message).not.toContain("status code 401");

    // The logged payload IS the closed shape — asserted directly, so a future
    // change that smuggles `error.message` in under another key still fails.
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), { threw: "error" });
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain("s3cret");
    expect(logged).not.toContain("status code 401");
  });

  it("logs no provider text even when the error's NAME carries it", async () => {
    // `Error.name` is writable, so a provider that echoes the request back can
    // put the submitted secret there just as easily as in `message`.
    provider = stubProvider({
      saveSettings: vi.fn(async () => {
        const error = new Error("safe");
        error.name = "AxiosError client_secret=s3cret";
        throw error;
      }),
    });

    await expect(
      saveGoogleOAuthConnectionAction(formDataOf({ clientId: "abc", clientSecret: "s3cret" })),
    ).rejects.toThrow("Unable to save the Google OAuth connection.");

    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("s3cret");
  });

  it("does not reject a LANDED save when the revalidate throws", async () => {
    // Everything after the save must degrade. The caller reads a rejection as
    // "nothing was stored" and offers the typed values back for a retry, which
    // would be a lie about a save that landed.
    revalidatePath.mockImplementationOnce(() => {
      throw new Error("revalidate is unavailable in this context");
    });

    const result = await saveGoogleOAuthConnectionAction(formDataOf({ clientId: "abc" }));

    expect(provider.saveSettings).toHaveBeenCalled();
    expect(result.status).toBe("connected");
    expect(JSON.stringify(consoleError.mock.calls)).toContain("revalidate failed");
    // The second surface is independent — it still gets its refresh.
    expect(revalidatePath).toHaveBeenCalledWith("/connectors");
  });

  it("is authorized before it touches the provider at all", async () => {
    requireExtensionAction.mockRejectedValueOnce(new Error("forbidden"));

    await expect(
      saveGoogleOAuthConnectionAction(formDataOf({ clientId: "abc" })),
    ).rejects.toThrow("forbidden");
    expect(provider.saveSettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the status read BACK from the host facade, not the submitted values", async () => {
    provider = stubProvider({
      getStatus: vi.fn(async () => ({
        status: "incomplete" as const,
        detail: "The connection service (Nango) rejected this instance's API secret key…",
      })),
    });

    const result = await saveGoogleOAuthConnectionAction(formDataOf({ clientId: "abc", clientSecret: "s3cret" }));

    expect(provider.getStatus).toHaveBeenCalled();
    expect(result.status).toBe("incomplete");
  });

  it("carries no secret and no provider-supplied text on the result", async () => {
    provider = stubProvider({
      getStatus: vi.fn(async () => ({
        status: "incomplete" as const,
        detail: "classified explanation that stays server-side",
      })),
    });

    const result = await saveGoogleOAuthConnectionAction(formDataOf({ clientId: "abc", clientSecret: "s3cret" }));

    // The whole serialized result is exactly one enum field.
    expect(Object.keys(result)).toEqual(["status"]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("s3cret");
    expect(serialized).not.toContain("classified explanation");
  });

  it("does not turn a landed save into a failure when the status read-back throws", async () => {
    provider = stubProvider({
      getStatus: vi.fn(async () => {
        throw new Error("nango unreachable: connect ECONNREFUSED 127.0.0.1:3003");
      }),
    });

    const result = await saveGoogleOAuthConnectionAction(formDataOf({ clientId: "abc" }));

    expect(result.status).toBeUndefined();
    // The save still refreshed the route — the durable state lives there.
    expect(revalidatePath).toHaveBeenCalledWith(SETUP_PATH);
    // Leak rail: the read-back log records a CLOSED shape, never the error's
    // own text (a connection-service message can echo back what was sent).
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("read-back failed");
    expect(logged).not.toContain("ECONNREFUSED");
    expect(logged).not.toContain("nango unreachable");
  });
});

describe("saveGoogleOAuthConnectionAction — revalidated path matches the published route", () => {
  const actionsSrc = readFileSync(fileURLToPath(new URL("../actions.ts", import.meta.url)), "utf8");
  const indexSrc = readFileSync(fileURLToPath(new URL("../index.ts", import.meta.url)), "utf8");

  it("revalidates exactly the settingsHref this package publishes", () => {
    // A text pin, because the constant cannot be imported: a `"use server"`
    // module may export only async functions. Tolerant of quote style so a
    // formatter change fails nothing.
    const settingsHref = /settingsHref:\s*["']([^"']+)["']/.exec(indexSrc)?.[1];
    expect(settingsHref).toBe(SETUP_PATH);
    const declared = /const SETUP_PATH\s*=\s*["']([^"']+)["']/.exec(actionsSrc)?.[1];
    expect(
      declared,
      "SETUP_PATH in actions.ts must equal settingsHref in index.ts — a route rename left a revalidate pointing at a path that no longer exists",
    ).toBe(settingsHref);
  });
});
