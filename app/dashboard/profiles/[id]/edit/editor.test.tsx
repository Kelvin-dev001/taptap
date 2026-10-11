import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui";
import type { ComparableContent } from "@/lib/page-diff";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabase: () => ({}) }));

const savePageAction = vi.fn();
const publishPageAction = vi.fn();
vi.mock("./actions", () => ({
  savePageAction: (...a: unknown[]) => savePageAction(...a),
  publishPageAction: (...a: unknown[]) => publishPageAction(...a),
  unpublishPageAction: vi.fn(),
}));

const { default: Editor } = await import("./editor");

const ACTION = "3f6c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f";
const live: ComparableContent = {
  title: "Mama Mboga",
  mode: "page",
  config: {},
  theme: {},
  links: [{ type: "call", label: "Call", value: "0722000000", sort_order: 0 }],
};

function renderEditor(
  blocks: Parameters<typeof Editor>[0]["initialBlocks"] = [
    { id: ACTION, type: "call", label: "Call", value: "0722000000", sort_order: 0, is_active: true },
  ],
) {
  return render(
    <ToastProvider>
      <Editor
        pageId="page-1"
        accountId="acct-1"
        slug="mama-mboga"
        siteBase="https://taptap.example"
        initialTitle="Mama Mboga"
        initialMode="page"
        initialRedirectUrl=""
        initialConfig={{}}
        initialTheme={{}}
        initialBlocks={blocks}
        initialStatus="published"
        initialPublishedAt="2026-10-01T09:00:00Z"
        initialUpdatedAt="v1"
        publishedSnapshot={live}
        leadCaptureAllowed
        planLapsed={false}
        canPublish
        publishBlockedReason={null}
      />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Typing through a full editor takes a few seconds in jsdom, and longer when the
// whole suite runs in parallel; the default 5 s limit made these flaky.
describe("Editor saving", { timeout: 20_000 }, () => {
  it("sends each action with its id and the version it was based on", async () => {
    savePageAction.mockResolvedValue({ success: "Saved.", updatedAt: "v2" });
    const user = userEvent.setup();
    renderEditor();

    await user.type(screen.getByLabelText("Business name"), " Fresh");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(savePageAction).toHaveBeenCalledTimes(1));
    const [pageId, payload] = savePageAction.mock.calls[0];
    expect(pageId).toBe("page-1");
    expect(payload).toMatchObject({
      expectedUpdatedAt: "v1",
      title: "Mama Mboga Fresh",
      blocks: [{ id: ACTION, type: "call", label: "Call", value: "0722000000", isActive: true }],
    });

    // The next save is based on the version the first one returned.
    await user.type(screen.getByLabelText("Business name"), "!");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(savePageAction).toHaveBeenCalledTimes(2));
    expect(savePageAction.mock.calls[1][1].expectedUpdatedAt).toBe("v2");
  });

  it("keeps saying 'Unpublished changes' after a save, until they are published", async () => {
    savePageAction.mockResolvedValue({ success: "Saved.", updatedAt: "v2" });
    publishPageAction.mockResolvedValue({ publishedAt: "2026-10-11T10:00:00Z" });
    const user = userEvent.setup();
    renderEditor();

    expect(screen.queryByText("Unpublished changes")).toBeNull();
    await user.type(screen.getByLabelText("Business name"), " Fresh");
    expect(screen.getByText("Unpublished changes")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(savePageAction).toHaveBeenCalled());
    expect(screen.getByText("Unpublished changes")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Publish changes" }));
    await waitFor(() => expect(publishPageAction).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Unpublished changes")).toBeNull());
  });

  it("does not overwrite a change made elsewhere, and lets the owner choose", async () => {
    savePageAction
      .mockResolvedValueOnce({ conflict: { updatedAt: "v7" } })
      .mockResolvedValueOnce({ success: "Saved.", updatedAt: "v8" });
    const user = userEvent.setup();
    renderEditor();

    await user.type(screen.getByLabelText("Business name"), " Fresh");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("This profile was changed somewhere else")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Keep my version" }));
    await waitFor(() => expect(savePageAction).toHaveBeenCalledTimes(2));
    expect(savePageAction.mock.calls[1][1].expectedUpdatedAt).toBe("v7");
    await waitFor(() =>
      expect(screen.queryByText("This profile was changed somewhere else")).toBeNull(),
    );
  });

  it("gives a newly added action its own id before it is ever saved", async () => {
    savePageAction.mockResolvedValue({ success: "Saved.", updatedAt: "v2" });
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "Add action" }));
    await user.click(await screen.findByRole("button", { name: /^WhatsApp/ }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(savePageAction).toHaveBeenCalled());
    const blocks = savePageAction.mock.calls[0][1].blocks as { id: string; type: string }[];
    expect(blocks).toHaveLength(2);
    expect(blocks[1].type).toBe("whatsapp");
    expect(blocks[1].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(blocks[1].id).not.toBe(ACTION);
  });

  /**
   * The bug that shipped on 11 Oct: a "Save contact" action has no value, and
   * an action saved without a label has none either. The database stores both
   * as null, the editor sent null back, and every save was refused.
   */
  it("saves a profile whose actions have no label or value in the database", async () => {
    savePageAction.mockResolvedValue({ success: "Saved.", updatedAt: "v2" });
    const user = userEvent.setup();
    renderEditor([
      // Straight from the database: nulls, as Supabase returns them.
      { id: ACTION, type: "contact", label: null, value: null, sort_order: 0, is_active: true } as never,
    ]);

    await user.type(screen.getByLabelText("Business name"), "!");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(savePageAction).toHaveBeenCalled());
    const payload = savePageAction.mock.calls[0][1];
    expect(payload.blocks).toEqual([{ id: ACTION, type: "contact", label: "", value: "", isActive: true }]);
    // ...and the server-side check accepts exactly that.
    const { parseDraftInput } = await import("@/lib/draft");
    expect(parseDraftInput(payload).ok).toBe(true);
  });
});
