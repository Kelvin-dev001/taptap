import { describe, expect, it } from "vitest";
import { differsFromLive, type ComparableContent } from "./page-diff";

/** What build_page_snapshot (0009) stores: active actions only, with ids and sort_order. */
const snapshot: ComparableContent = {
  title: "Mama Mboga",
  mode: "page",
  redirect_url: null,
  config: { bio: "Fresh daily", tagline: "Westlands", leadForm: { enabled: false } },
  theme: { accent: "#c2560a", preset: "light" },
  links: [
    { type: "whatsapp", label: "Chat", value: "0722000000", sort_order: 0 },
    { type: "call", label: null, value: "0722000000", sort_order: 1 },
  ],
};

/** The same profile as an editor holds it: every action, in display order, with is_active. */
const draft = (): ComparableContent => ({
  title: "Mama Mboga ",
  mode: "page",
  redirect_url: "",
  config: { tagline: "Westlands", bio: "Fresh daily", avatarUrl: undefined, leadForm: { enabled: false } },
  theme: { preset: "light", accent: "#c2560a" },
  links: [
    { type: "whatsapp", label: "Chat", value: "0722000000", is_active: true },
    { type: "email", label: "Email", value: "a@b.co", is_active: false },
    { type: "call", label: "", value: " 0722000000", is_active: true },
  ],
});

describe("differsFromLive", () => {
  it("treats the same content as the same, however it is held", () => {
    expect(differsFromLive(snapshot, draft())).toBe(false);
  });

  it("always differs when nothing has been published", () => {
    expect(differsFromLive(null, draft())).toBe(true);
    expect(differsFromLive(undefined, draft())).toBe(true);
  });

  it.each<[string, (d: ComparableContent) => void]>([
    ["the title", (d) => void (d.title = "Mama Mboga Fresh")],
    ["the bio", (d) => void (d.config = { ...d.config, bio: "Fresh twice a day" })],
    ["a new photo", (d) => void (d.config = { ...d.config, avatarUrl: "https://x/a.jpg" })],
    ["the lead form", (d) => void (d.config = { ...d.config, leadForm: { enabled: true } })],
    ["the colour", (d) => void (d.theme = { ...d.theme, accent: "#111827" })],
    ["an action's label", (d) => void (d.links![0].label = "WhatsApp us")],
    ["the order of actions", (d) => void d.links!.reverse()],
    ["switching an action on", (d) => void (d.links![1].is_active = true)],
    ["switching an action off", (d) => void (d.links![0].is_active = false)],
    ["the profile's type", (d) => void (d.mode = "redirect")],
  ])("notices a change to %s", (_name, change) => {
    const d = draft();
    change(d);
    expect(differsFromLive(snapshot, d)).toBe(true);
  });

  it("ignores action ids: deleting and re-adding the same action changes nothing a customer sees", () => {
    const withIds = { ...snapshot, links: snapshot.links!.map((l, i) => ({ ...l, id: `old-${i}` })) };
    const d = draft();
    d.links = d.links!.map((l, i) => ({ ...l, id: `new-${i}` }));
    expect(differsFromLive(withIds, d)).toBe(false);
  });

  it("orders a snapshot by sort_order", () => {
    const shuffled = { ...snapshot, links: [...snapshot.links!].reverse() };
    expect(differsFromLive(shuffled, draft())).toBe(false);
  });

  it("compares only the destination of a redirect profile", () => {
    const live = { mode: "redirect", redirect_url: "https://wa.me/254722000000", title: "Old" };
    expect(differsFromLive(live, { ...live, title: "New", config: { bio: "x" } })).toBe(false);
    expect(differsFromLive(live, { ...live, redirect_url: "https://wa.me/254733000000" })).toBe(true);
  });
});
