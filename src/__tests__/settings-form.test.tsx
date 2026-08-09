// @vitest-environment jsdom
/**
 * GoogleOAuthSettingsForm error-notification contract
 * (host pattern: cinatra-ai/cinatra#51).
 *
 * In a Next.js production build, a Server Action that throws has its real
 * `Error.message` replaced by the framework's generic masking blurb before it
 * reaches the client `catch`. The form's failure notification must therefore
 * carry friendly, operation-specific copy — never the caught
 * `error.message` — or production users see the masking paragraph as the
 * toast body.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addNotification = vi.fn();

vi.mock("@cinatra-ai/sdk-ui", () => ({
  useNotify: () => ({ addNotification }),
}));

vi.mock("../actions", () => ({
  saveGoogleOAuthConnectionAction: vi.fn(),
}));

import { GoogleOAuthSettingsForm } from "../settings-form";
import { saveGoogleOAuthConnectionAction } from "../actions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// Shape of what the client receives from a rejected Server Action in a
// production build: an Error instance carrying the masking text instead of
// the original server-side message.
const PROD_MASKED_MESSAGE =
  "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.";

const mountedRoots: Root[] = [];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

async function renderAndSubmit(
  typed: { clientId?: string; clientSecret?: string } = {},
): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(
      <GoogleOAuthSettingsForm
        administration={{}}
        status={{ status: "not_connected" }}
      />,
    );
  });

  const form = container.querySelector("form");
  expect(form).not.toBeNull();

  for (const [name, value] of Object.entries(typed)) {
    if (value === undefined) continue;
    const field = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    expect(field).not.toBeNull();
    field!.value = value;
  }

  await act(async () => {
    form!.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    // Let the form action's async rejection settle.
    await Promise.resolve();
  });

  return container;
}

describe("GoogleOAuthSettingsForm server-action rejection", () => {
  it("shows the friendly operation-specific notification when the action rejects with a prod-masked Error", async () => {
    vi.mocked(saveGoogleOAuthConnectionAction).mockRejectedValueOnce(
      new Error(PROD_MASKED_MESSAGE),
    );

    await renderAndSubmit();

    expect(addNotification).toHaveBeenCalledTimes(1);
    expect(addNotification).toHaveBeenCalledWith({
      title: "Google OAuth save failed",
      body: "Unable to save the Google OAuth connection.",
      kind: "error",
    });
    const { title, body } = addNotification.mock.calls[0][0] as {
      title: string;
      body: string;
    };
    expect(body).not.toContain("omitted in production");
    expect(body).not.toContain(PROD_MASKED_MESSAGE);
    // The title identifies the failed operation (not a bare "Save failed").
    expect(title).not.toBe("Save failed");
  });

  it("shows the success notification when the action resolves connected", async () => {
    vi.mocked(saveGoogleOAuthConnectionAction).mockResolvedValueOnce({
      status: "connected",
    });

    await renderAndSubmit();

    expect(addNotification).toHaveBeenCalledTimes(1);
    expect(addNotification).toHaveBeenCalledWith({
      title: "Google OAuth connection saved",
      body: "Google OAuth settings have been updated.",
      kind: "success",
    });
  });

  // cinatra#2552: a save whose connection-service mirror fails now PERSISTS and
  // reports "incomplete" rather than throwing. Reporting that as a flat success
  // would hide the only moment the operator is looking at the page.
  it("warns instead of claiming success when the save persisted but the setup is incomplete", async () => {
    vi.mocked(saveGoogleOAuthConnectionAction).mockResolvedValueOnce({
      status: "incomplete",
    });

    await renderAndSubmit();

    expect(addNotification).toHaveBeenCalledTimes(1);
    const notification = addNotification.mock.calls[0][0] as {
      title: string;
      body: string;
      kind: string;
    };
    expect(notification.kind).toBe("warning");
    // Truthful on both counts: the values ARE stored, and the setup is not done.
    expect(notification.title).toContain("saved");
    expect(notification.title).toContain("incomplete");
    // Points at the panel, which server-renders the classified cause + recourse.
    expect(notification.body).toContain("stored");
    expect(notification.body).toContain("setup panel");
  });

  it("keeps what the operator typed when the save is rejected", async () => {
    vi.mocked(saveGoogleOAuthConnectionAction).mockRejectedValueOnce(
      new Error("Unable to save the Google OAuth connection."),
    );

    const container = await renderAndSubmit({
      clientId: "typed.apps.googleusercontent.com",
      clientSecret: "typed-secret",
    });

    // Nothing was stored, so these values are the only copy that exists — the
    // form must not clear them the way a settled form action otherwise would.
    expect(container.querySelector<HTMLInputElement>('input[name="clientId"]')?.value).toBe(
      "typed.apps.googleusercontent.com",
    );
    expect(container.querySelector<HTMLInputElement>('input[name="clientSecret"]')?.value).toBe(
      "typed-secret",
    );
    // …and it says plainly that what is on screen was not stored.
    expect(
      container
        .querySelector("[data-google-oauth-saved-state]")
        ?.getAttribute("data-google-oauth-saved-state"),
    ).toBe("rejected");
  });

  it("still reports a plain success when the status read-back yielded nothing", async () => {
    // The action swallows a post-save status read failure so a landed save is
    // never reported as failed; the toast falls back to the success copy.
    vi.mocked(saveGoogleOAuthConnectionAction).mockResolvedValueOnce({
      status: undefined,
    });

    await renderAndSubmit();

    expect(addNotification).toHaveBeenCalledTimes(1);
    expect(addNotification.mock.calls[0][0]).toMatchObject({ kind: "success" });
  });
});
