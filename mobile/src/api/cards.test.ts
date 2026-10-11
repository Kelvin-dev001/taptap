import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { registerCardEdits, RENAME_CARD, type CardRename } from "./card-edits";
import { cardChangeErrorOf, fetchCards, identifyForeignCard, linkCard, renameCard, setCardOn, type Card } from "./cards";

const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const mockSelect = jest.fn();
jest.mock("./supabase", () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({
      select: () => ({ order: async () => mockSelect() }),
      update: (patch: unknown) => ({
        eq: async (_c: string, id: string) => {
          mockUpdate(id, patch);
          return { error: null };
        },
      }),
    }),
  },
}));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: () => undefined } }));

beforeEach(() => {
  mockRpc.mockReset();
  mockUpdate.mockReset();
  mockSelect.mockReset();
});

describe("cards", () => {
  it("marks placeholder cards so nothing offers to tap them", async () => {
    mockSelect.mockResolvedValue({
      data: [
        { id: "a", token: "t", kind: "card", label: null, status: "unassigned", account_id: "x", smart_page_id: null, term_start: null, term_end: null, claimed_at: null, serial: null, variant: null, is_placeholder: true },
        { id: "b", token: "t2", kind: "stand", label: "Till", status: "assigned", account_id: "x", smart_page_id: "p", term_start: null, term_end: null, claimed_at: null, serial: "TT-1", variant: null, is_placeholder: null },
      ],
      error: null,
    });
    const cards = await fetchCards();
    expect(cards.map((c) => c.isPlaceholder)).toEqual([true, false]);
  });

  it("links and switches through the web's functions, never a direct write", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await linkCard("c1", "p1");
    await setCardOn("c1", false);
    await setCardOn("c1", true);
    expect(mockRpc.mock.calls).toEqual([
      ["rebind_tag", { p_tag_id: "c1", p_page_id: "p1" }],
      ["set_tag_status", { p_tag_id: "c1", p_status: "disabled" }],
      ["set_tag_status", { p_tag_id: "c1", p_status: "assigned" }],
    ]);
  });

  it("names a card with its own column only, trimmed and at most 60 characters", async () => {
    await renameCard("c1", "  Reception  ");
    await renameCard("c1", "   ");
    await renameCard("c1", "x".repeat(80));
    expect(mockUpdate.mock.calls).toEqual([
      ["c1", { label: "Reception" }],
      ["c1", { label: null }],
      ["c1", { label: "x".repeat(60) }],
    ]);
  });

  it("explains rebind_tag's refusals", () => {
    expect(cardChangeErrorOf("page_not_published")).toBe("not_published");
    expect(cardChangeErrorOf("card not found")).toBe("not_found");
    expect(cardChangeErrorOf("something else")).toBe("other");
  });
});

describe("identifyForeignCard", () => {
  it.each([
    [{ status: "unactivated", tag_id: "t" }, "unactivated"],
    [{ status: "assigned", tag_id: "t", page_id: "p", slug: "s" }, "someone_else"],
    [{ status: "unassigned", tag_id: "t", account_id: "a" }, "someone_else"],
    [null, "unknown"],
  ])("reads %j as %s", async (answer, expected) => {
    mockRpc.mockResolvedValue({ data: answer, error: null });
    await expect(identifyForeignCard("tok")).resolves.toBe(expected);
    expect(mockRpc).toHaveBeenCalledWith("resolve_tag", { p_token: "tok" });
  });
});

describe("renaming offline", () => {
  it("shows the new name at once and sends it through the registered function", async () => {
    const client = new QueryClient();
    registerCardEdits(client);
    client.setQueryData<Card[]>(["cards", "u"], [{ id: "c1", label: null, isPlaceholder: false, token: null, serial: null, variant: null }]);
    const observer = new MutationObserver<void, Error, CardRename>(client, { mutationKey: RENAME_CARD });
    const done = observer.mutate({ id: "c1", label: " Till " });
    await Promise.resolve();
    expect(client.getQueryData<Card[]>(["cards", "u"])?.[0].label).toBe("Till");
    await done;
    expect(mockUpdate).toHaveBeenCalledWith("c1", { label: "Till" });
  });
});
