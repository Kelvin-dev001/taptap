import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftInput } from "./draft";

const loadBillingContext = vi.fn();
vi.mock("./billing-context", () => ({ loadBillingContext: (...a: unknown[]) => loadBillingContext(...a) }));

const { saveDraft } = await import("./page-draft");

const PAGE = "9b2f6a1c-3d4e-4f50-8a6b-7c8d9e0f1a2b";
const A = "3f6c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f";
const B = "4a7d2e3f-9b5c-4d6e-8f10-2b3c4d5e6f70";

type Page = { id: string; account_id: string; mode: string } | null;

/** Just enough of a Supabase client: one page read and one RPC. */
function fakeClient(page: Page, rpc: { data?: unknown; error?: { code?: string; message: string } | null }) {
  const calls: { rpc?: [string, Record<string, unknown>]; filter?: [string, string] } = {};
  const client = {
    from: (table: string) => {
      expect(table).toBe("smart_pages");
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            calls.filter = [column, value];
            return { maybeSingle: async () => ({ data: page, error: null }) };
          },
        }),
      };
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.rpc = [name, args];
      return { data: rpc.data ?? null, error: rpc.error ?? null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const input = (overrides: Partial<DraftInput> = {}): DraftInput => ({
  expectedUpdatedAt: "2026-10-11T14:00:00.123456+00:00",
  title: "  Mama Mboga ",
  config: { bio: "Fresh", leadForm: { enabled: true } },
  theme: { accent: "#c2560a" },
  blocks: [
    { id: A, type: "whatsapp", label: " Chat ", value: "0722000000 ", isActive: true },
    { id: B, type: "website", label: "", value: "mamamboga.co.ke", isActive: false },
  ],
  ...overrides,
});

const page = { id: PAGE, account_id: "acct-1", mode: "page" };

beforeEach(() => {
  loadBillingContext.mockReset();
  loadBillingContext.mockResolvedValue({ entitlements: { leadCapture: true } });
});

describe("saveDraft", () => {
  it("sends every action with its own id, in order, to save_page_draft", async () => {
    const { client, calls } = fakeClient(page, { data: { ok: true, updated_at: "v2" } });
    await expect(saveDraft(client, PAGE, input())).resolves.toEqual({ ok: true, updatedAt: "v2" });

    expect(calls.filter).toEqual(["id", PAGE]);
    const [name, args] = calls.rpc!;
    expect(name).toBe("save_page_draft");
    expect(args).toEqual({
      p_page_id: PAGE,
      p_expected_updated_at: "2026-10-11T14:00:00.123456+00:00",
      p_title: "Mama Mboga",
      p_mode: "page",
      p_redirect_url: null,
      p_config: { bio: "Fresh", leadForm: { enabled: true } },
      p_theme: { accent: "#c2560a" },
      p_blocks: [
        { id: A, type: "whatsapp", label: "Chat", value: "0722000000", is_active: true },
        { id: B, type: "website", label: "", value: "mamamboga.co.ke", is_active: false },
      ],
    });
    expect(loadBillingContext).toHaveBeenCalledWith(client, "acct-1");
  });

  it("switches the lead form off for an account without a live card", async () => {
    loadBillingContext.mockResolvedValue({ entitlements: { leadCapture: false } });
    const { client, calls } = fakeClient(page, { data: { ok: true, updated_at: "v2" } });
    await saveDraft(client, PAGE, input());
    expect(calls.rpc![1].p_config).toEqual({ bio: "Fresh", leadForm: { enabled: false } });
  });

  it("keeps a redirect profile's type and sends no actions", async () => {
    const { client, calls } = fakeClient(
      { ...page, mode: "redirect" },
      { data: { ok: true, updated_at: "v2" } },
    );
    await saveDraft(client, PAGE, input({ redirectUrl: " https://wa.me/254722000000 " }));
    expect(calls.rpc![1]).toMatchObject({
      p_mode: "redirect",
      p_redirect_url: "https://wa.me/254722000000",
      p_blocks: null,
    });
  });

  it("lets the web editor switch the type", async () => {
    const { client, calls } = fakeClient(page, { data: { ok: true, updated_at: "v2" } });
    await saveDraft(client, PAGE, input({ mode: "redirect", redirectUrl: "https://x.co" }));
    expect(calls.rpc![1]).toMatchObject({ p_mode: "redirect", p_blocks: null });
  });

  it("refuses a page it cannot see without writing", async () => {
    const { client, calls } = fakeClient(null, {});
    await expect(saveDraft(client, PAGE, input())).resolves.toEqual({ ok: false, code: "not_found" });
    expect(calls.rpc).toBeUndefined();
  });

  it("refuses a dead destination before writing, naming the action", async () => {
    const { client, calls } = fakeClient(page, {});
    const blocks = [...input().blocks];
    blocks[1] = { ...blocks[1], value: "not a site" };
    await expect(saveDraft(client, PAGE, input({ blocks }))).resolves.toEqual({
      ok: false,
      code: "invalid_destination",
      index: 1,
    });
    expect(calls.rpc).toBeUndefined();
  });

  it("refuses a redirect to an unsafe scheme", async () => {
    const { client } = fakeClient({ ...page, mode: "redirect" }, {});
    await expect(
      saveDraft(client, PAGE, input({ redirectUrl: "javascript:alert(1)" })),
    ).resolves.toEqual({ ok: false, code: "invalid_redirect" });
  });

  it("passes a conflict back with the other version", async () => {
    const { client } = fakeClient(page, { data: { ok: false, code: "conflict", updated_at: "v9" } });
    await expect(saveDraft(client, PAGE, input())).resolves.toEqual({
      ok: false,
      code: "conflict",
      updatedAt: "v9",
    });
  });

  it("maps the database's answers and errors", async () => {
    const cases: [Parameters<typeof fakeClient>[1], unknown][] = [
      [{ data: { ok: false, code: "not_found" } }, { ok: false, code: "not_found" }],
      [{ error: { code: "PGRST202", message: "Could not find the function" } }, { ok: false, code: "schema_pending" }],
      [{ error: { code: "P0001", message: "invalid_block_id" } }, { ok: false, code: "invalid_block" }],
      [{ error: { code: "P0001", message: "duplicate_block_id" } }, { ok: false, code: "invalid_block" }],
      [{ error: { code: "57014", message: "timeout" } }, { ok: false, code: "error", message: "timeout" }],
      [{ data: { surprise: true } }, { ok: false, code: "error", message: "Unexpected answer from save_page_draft." }],
    ];
    for (const [rpc, expected] of cases) {
      const { client } = fakeClient(page, rpc);
      await expect(saveDraft(client, PAGE, input())).resolves.toEqual(expected);
    }
  });
});
