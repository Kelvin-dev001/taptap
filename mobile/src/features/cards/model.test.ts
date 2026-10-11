import i18n from "@/i18n";
import type { Card } from "@/api/cards";
import type { Profile } from "@/api/pages";
import { cardBadge, cardName, cardTermLine, cardWorks, findBySerial, linkableProfiles, normaliseSerial } from "./model";

const t = i18n.t.bind(i18n);
const NOW = new Date("2026-10-11T10:00:00Z");

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: "c1",
    token: "0123456789abcdef0123456789abcdef",
    kind: "card",
    label: null,
    status: "assigned",
    account_id: "acct",
    smart_page_id: "p1",
    term_start: "2026-01-01T00:00:00Z",
    term_end: "2027-01-01T00:00:00Z",
    claimed_at: "2026-01-02T00:00:00Z",
    serial: "TT-000123",
    variant: "standard",
    isPlaceholder: false,
    ...overrides,
  };
}

describe("card state, in neutral words (PLAN.md §3)", () => {
  it.each<[string, Partial<Card>, string, RegExp]>([
    ["active", {}, "active", /^Active until 1 Jan 2027$/],
    ["no term recorded", { term_end: null }, "active", /^Active$/],
    ["ending soon", { term_end: "2026-10-23T10:00:00Z" }, "ending", /^Active until 23 Oct 2026 · 12 days left$/],
    ["ending tomorrow", { term_end: "2026-10-12T10:00:00Z" }, "ending", /^Active until 12 Oct 2026 · 1 day left$/],
    ["in grace", { term_end: "2026-10-05T00:00:00Z" }, "grace", /^Term ended 5 Oct 2026\. Still working until 19 Oct 2026\.$/],
    ["lapsed", { term_end: "2026-09-01T00:00:00Z" }, "inactive", /^Not active since 15 Sept? 2026$/],
    ["switched off", { status: "disabled" }, "off", /^Switched off\./],
    ["being prepared", { isPlaceholder: true }, "preparing", /being prepared/],
  ])("%s", (_name, overrides, badge, line) => {
    const c = card(overrides);
    expect(cardBadge(c, NOW)).toBe(badge);
    expect(cardTermLine(t, c, NOW)).toMatch(line);
  });

  it("never asks the owner to pay, renew or buy", () => {
    const states: Partial<Card>[] = [
      {},
      { term_end: "2026-10-23T10:00:00Z" },
      { term_end: "2026-10-05T00:00:00Z" },
      { term_end: "2026-09-01T00:00:00Z" },
      { status: "disabled" },
      { isPlaceholder: true },
    ];
    for (const s of states) {
      expect(cardTermLine(t, card(s), NOW)).not.toMatch(/renew|pay|buy|KES|price|subscri/i);
    }
  });
});

describe("cardWorks", () => {
  it("is true only when a tap would open something", () => {
    expect(cardWorks(card(), NOW)).toBe(true);
    expect(cardWorks(card({ term_end: "2026-10-05T00:00:00Z" }), NOW)).toBe(true); // grace still works
    expect(cardWorks(card({ term_end: "2026-09-01T00:00:00Z" }), NOW)).toBe(false);
    expect(cardWorks(card({ status: "disabled" }), NOW)).toBe(false);
    expect(cardWorks(card({ smart_page_id: null }), NOW)).toBe(false);
    expect(cardWorks(card({ isPlaceholder: true }), NOW)).toBe(false);
  });
});

describe("cardName", () => {
  it("uses the owner's name, then the serial, then the end of the token", () => {
    expect(cardName(t, card({ label: " Reception " }))).toBe("Reception");
    expect(cardName(t, card())).toBe("Card TT-000123");
    expect(cardName(t, card({ serial: null }))).toBe("Card ···abcdef");
    expect(cardName(t, card({ serial: null, kind: "stand" }))).toBe("Stand ···abcdef");
  });
});

describe("serials", () => {
  it("match however they are typed", () => {
    expect(normaliseSerial(" tt-000 123 ")).toBe("TT000123");
    const cards = [card({ id: "a", serial: "TT-000123" }), card({ id: "b", serial: "TT-000124" })];
    expect(findBySerial(cards, "tt000124")?.id).toBe("b");
    expect(findBySerial(cards, "TT 000123")?.id).toBe("a");
    expect(findBySerial(cards, "TT-999999")).toBeUndefined();
    expect(findBySerial(cards, "  ")).toBeUndefined();
  });
});

describe("linkableProfiles", () => {
  it("offers only live profiles: a card pointed at a draft would open nothing (D-021)", () => {
    const p = (id: string, status: "published" | "draft", isActive = true) => ({ id, status, isActive }) as Profile;
    expect(linkableProfiles([p("a", "published"), p("b", "draft"), p("c", "published", false)]).map((x) => x.id)).toEqual(["a"]);
  });
});
