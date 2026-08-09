// @vitest-environment jsdom
/**
 * Persistent saved/connected state in the setup panel
 * (google-oauth-connector#57).
 *
 * The action's `revalidatePath` makes the server re-render with the stored
 * configuration; these pins cover what that re-render must actually SHOW:
 *
 *   1. the stored client id is in the field (and survives the React 19
 *      post-action `<form>` reset — see the remount pin below);
 *   2. a saved-state affordance that does not fade like the toast does;
 *   3. the cinatra#2552 degraded state reads as a warning carrying the
 *      classified cause and the recourse, not as a neutral note.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { GoogleOAuthSettingsPanel } from "../settings-panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type PanelProps = Parameters<typeof GoogleOAuthSettingsPanel>[0];

const mounted: Array<{ root: Root; container: HTMLElement }> = [];

afterEach(() => {
  for (const { root } of mounted.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = "";
});

function render(props: Partial<PanelProps> = {}): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  act(() => {
    root.render(
      <GoogleOAuthSettingsPanel
        settings={{}}
        status={{ status: "not_connected" }}
        action={() => {}}
        showConnectionActions={false}
        {...props}
      />,
    );
  });
  return container;
}

function rerender(container: HTMLElement, props: Partial<PanelProps>): void {
  const entry = mounted.find((m) => m.container === container);
  if (!entry) throw new Error("container was never rendered");
  act(() => {
    entry.root.render(
      <GoogleOAuthSettingsPanel
        settings={{}}
        status={{ status: "not_connected" }}
        action={() => {}}
        showConnectionActions={false}
        {...props}
      />,
    );
  });
}

const savedState = (container: HTMLElement): string | null =>
  container
    .querySelector("[data-google-oauth-saved-state]")
    ?.getAttribute("data-google-oauth-saved-state") ?? null;

describe("saved-state affordance", () => {
  it("reads 'Not saved yet' when nothing is stored", () => {
    const container = render();
    expect(savedState(container)).toBe("unsaved");
    expect(container.textContent).toContain("Not saved yet");
  });

  it("reads Saved once a client id is stored", () => {
    const container = render({ settings: { clientId: "abc.apps.googleusercontent.com" } });
    expect(savedState(container)).toBe("saved");
    expect(container.textContent).toContain("Saved");
  });

  it("reads Saved from a stored secret alone (the secret is write-only, reported as a boolean)", () => {
    const container = render({ settings: { clientSecretSet: true } });
    expect(savedState(container)).toBe("saved");
  });
});

describe("stored configuration is rendered back", () => {
  it("pre-fills the client-id field from the stored value", () => {
    const container = render({ settings: { clientId: "abc.apps.googleusercontent.com" } });
    const input = container.querySelector<HTMLInputElement>('input[name="clientId"]');
    expect(input?.value).toBe("abc.apps.googleusercontent.com");
  });

  it("shows the redacted 'saved' placeholder for the stored secret", () => {
    const container = render({ settings: { clientId: "abc", clientSecretSet: true } });
    const secret = container.querySelector<HTMLInputElement>('input[name="clientSecret"]');
    expect(secret?.value).toBe("");
    expect(secret?.placeholder).toContain("saved");
  });

  it("REMOUNTS the client-id field when the saved value changes, so the new value is the node's value and not merely its defaultValue", () => {
    // This is the post-save case. React 19 resets the form once the action
    // settles; a surviving node would be reset to whatever value it currently
    // holds as `defaultValue`, and React never rewrites an uncontrolled node's
    // current value on a props change. Simulating the reset here proves the
    // refreshed value is what the operator ends up looking at.
    const container = render({ settings: {} });
    const before = container.querySelector<HTMLInputElement>('input[name="clientId"]');
    expect(before?.value).toBe("");

    rerender(container, { settings: { clientId: "abc.apps.googleusercontent.com" } });

    const after = container.querySelector<HTMLInputElement>('input[name="clientId"]');
    expect(after).not.toBe(before);
    expect(after?.value).toBe("abc.apps.googleusercontent.com");

    container.querySelector("form")?.reset();
    expect(
      container.querySelector<HTMLInputElement>('input[name="clientId"]')?.value,
    ).toBe("abc.apps.googleusercontent.com");
  });
});

describe("a REJECTED save keeps what the operator typed", () => {
  // A rejected save stored nothing, so the typed values are the only copy that
  // exists. React 19 resets the form once the action settles — and the handler
  // settles normally on failure too, because it catches in order to toast — so
  // without this the failure path clears the fields exactly like the bug #57 is
  // about.
  it("puts both typed values back after the form reset", () => {
    const container = render({ settings: {} });
    rerender(container, {
      settings: {},
      rejectedInput: {
        attempt: 1,
        clientId: "typed.apps.googleusercontent.com",
        clientSecret: "typed-secret",
      },
    });

    container.querySelector("form")?.reset();

    expect(container.querySelector<HTMLInputElement>('input[name="clientId"]')?.value).toBe(
      "typed.apps.googleusercontent.com",
    );
    expect(container.querySelector<HTMLInputElement>('input[name="clientSecret"]')?.value).toBe(
      "typed-secret",
    );
  });

  it("remounts on a SECOND rejection carrying identical values", () => {
    // Two consecutive failures of the same retry must not fall back to
    // depending on React's reset ordering; the attempt counter keys them apart.
    const container = render({
      settings: {},
      rejectedInput: { attempt: 1, clientId: "typed", clientSecret: "typed-secret" },
    });
    const first = container.querySelector('input[name="clientId"]');

    rerender(container, {
      settings: {},
      rejectedInput: { attempt: 2, clientId: "typed", clientSecret: "typed-secret" },
    });

    const second = container.querySelector<HTMLInputElement>('input[name="clientId"]');
    expect(second).not.toBe(first);
    expect(second?.value).toBe("typed");
  });

  it("gives focus back to the field the remount took it from", () => {
    // Submitting with Enter from inside a field, then a rejection, replaces the
    // focused node. Without the restore, focus lands on nothing.
    const container = render({ settings: {} });
    const before = container.querySelector<HTMLInputElement>('input[name="clientId"]');
    act(() => before!.focus());
    expect(document.activeElement).toBe(before);
    // The remount is what drops focus: model that by blurring first.
    act(() => before!.blur());

    rerender(container, {
      settings: {},
      rejectedInput: { attempt: 1, clientId: "typed", clientSecret: "typed-secret" },
    });

    const after = container.querySelector<HTMLInputElement>('input[name="clientId"]');
    expect(after).not.toBe(before);
    expect(document.activeElement).toBe(after);
    // Caret at the end, so the restored value is ready to edit.
    expect(after?.selectionStart).toBe("typed".length);
  });

  it("leaves focus alone when something else holds it", () => {
    // Saving with the mouse leaves focus on the Save button; the remount must
    // not yank it into a credential field.
    const container = render({ settings: {} });
    const field = container.querySelector<HTMLInputElement>('input[name="clientId"]');
    act(() => field!.focus());
    const save = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Save Google OAuth"),
    );
    act(() => save!.focus());

    rerender(container, {
      settings: {},
      rejectedInput: { attempt: 1, clientId: "typed", clientSecret: "typed-secret" },
    });

    expect(document.activeElement).toBe(save);
  });

  it("says the DISPLAYED values are not saved, even when an older client is stored", () => {
    // Reporting "Saved" here would be true of the stored client and false of
    // everything on screen.
    const container = render({
      settings: { clientId: "old-id", clientSecretSet: true },
      rejectedInput: { attempt: 1, clientId: "new-id", clientSecret: "new-secret" },
    });
    expect(savedState(container)).toBe("rejected");
    expect(container.textContent).toContain("These values are not saved");
    expect(container.querySelector<HTMLInputElement>('input[name="clientId"]')?.value).toBe(
      "new-id",
    );
  });

  it("hands the fields back to the stored values once a save lands", () => {
    const container = render({
      settings: {},
      rejectedInput: { attempt: 1, clientId: "typed", clientSecret: "typed-secret" },
    });
    rerender(container, {
      settings: { clientId: "stored.apps.googleusercontent.com", clientSecretSet: true },
      rejectedInput: null,
    });

    container.querySelector("form")?.reset();

    expect(container.querySelector<HTMLInputElement>('input[name="clientId"]')?.value).toBe(
      "stored.apps.googleusercontent.com",
    );
    // The stored secret is write-only: blank field, "saved" placeholder.
    const secret = container.querySelector<HTMLInputElement>('input[name="clientSecret"]');
    expect(secret?.value).toBe("");
    expect(secret?.placeholder).toContain("saved");
    expect(savedState(container)).toBe("saved");
  });
});

describe("connection status detail", () => {
  it("gives the cinatra#2552 degraded state the warning treatment with its cause and recourse", () => {
    const detail =
      "The connection service (Nango) rejected this instance's API secret key, so the Google OAuth " +
      "client could not be stored there. Set NANGO_SECRET_KEY to the secret key of your Nango " +
      "environment. The client values are saved on this instance.";
    const container = render({
      settings: { clientId: "abc", clientSecretSet: true },
      status: { status: "incomplete", detail },
    });

    // The values are still reported as saved — a degraded mirror does not undo
    // the local save (that is exactly what cinatra#2552 fixed).
    expect(savedState(container)).toBe("saved");

    const block = container.querySelector('[role="status"] > div');
    expect(block?.textContent).toBe(detail);
    expect(block?.className).toContain("warning");
    expect(block?.className).not.toContain("bg-surface-strong");
  });

  it("keeps the neutral treatment for a connected detail", () => {
    const detail = "Google OAuth is configured for Cinatra.";
    const container = render({
      settings: { clientId: "abc", clientSecretSet: true },
      status: { status: "connected", detail },
    });
    const block = container.querySelector('[role="status"] > div');
    expect(block?.textContent).toBe(detail);
    expect(block?.className).toContain("bg-surface-strong");
    expect(block?.className).not.toContain("warning");
  });

  it("keeps a live region mounted even with no detail, so a detail that APPEARS after a save is announced", () => {
    const container = render();
    const live = container.querySelector('[role="status"]');
    expect(live).toBeTruthy();
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toBe("");
  });
});
