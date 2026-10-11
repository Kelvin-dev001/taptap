import type { Profile } from "@/api/pages";
import type { IdentityRow } from "@taptap/core/identity";
import {
  canPublish,
  draftFromProfile,
  draftInput,
  leadCaptureAllowed,
  livePage,
  pickProfile,
  previewPage,
  profileStatus,
  profileUrl,
  qrTarget,
  withSavedDraft,
} from "./model";

jest.mock("@/config/env", () => ({ env: { siteUrl: "https://taptap.example" } }));

const NOW = new Date("2026-10-11T10:00:00Z");
const ACTION = { id: "a1", type: "whatsapp", label: "Chat", value: "0722000000", isActive: true };

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "p1",
    slug: "mama-njeri",
    title: "Mama Njeri's",
    mode: "page",
    redirectUrl: null,
    config: { bio: "Coffee" },
    theme: {},
    status: "published",
    isActive: true,
    publishedAt: "2026-10-01T00:00:00Z",
    publishedContent: {
      title: "Mama Njeri's",
      mode: "page",
      config: { bio: "Coffee" },
      theme: {},
      links: [{ id: "a1", type: "whatsapp", label: "Chat", value: "0722000000", sort_order: 0 }],
    },
    updatedAt: "v1",
    createdAt: "2026-09-01T00:00:00Z",
    grandfathered: false,
    blocks: [ACTION],
    ...overrides,
  };
}

/** One card, claimed and paid until next year. */
const card: IdentityRow = {
  id: "c1",
  status: "assigned",
  account_id: "acct",
  term_end: "2027-09-01T00:00:00Z",
};

describe("profileStatus", () => {
  it("is live when customers see exactly the draft", () => {
    const p = profile();
    expect(profileStatus(p, [p], [card], undefined, NOW)).toBe("live");
  });

  it("is 'unpublished' once the draft differs, saved or not", () => {
    const p = profile();
    const edited = { ...draftFromProfile(p), title: "Mama Njeri's Kitchen" };
    expect(profileStatus(p, [p], [card], edited, NOW)).toBe("unpublished");
    const saved = profile({ title: "Mama Njeri's Kitchen" });
    expect(profileStatus(saved, [saved], [card], undefined, NOW)).toBe("unpublished");
  });

  it("is a draft when never published or taken down", () => {
    const p = profile({ status: "draft", publishedContent: null, publishedAt: null });
    expect(profileStatus(p, [p], [card], undefined, NOW)).toBe("draft");
  });

  it("is inactive when published but no live card covers it (D-018)", () => {
    const p = profile();
    expect(profileStatus(p, [p], [], undefined, NOW)).toBe("inactive");
    const lapsed = { ...card, term_end: "2026-01-01T00:00:00Z" };
    expect(profileStatus(p, [p], [lapsed], undefined, NOW)).toBe("inactive");
  });

  it("is live for a grandfathered profile without any card (D-023)", () => {
    const p = profile({ grandfathered: true });
    expect(profileStatus(p, [p], [], undefined, NOW)).toBe("live");
  });

  it("says 'off' for a profile switched off on the website, whatever else is true", () => {
    const p = profile({ isActive: false });
    expect(profileStatus(p, [p], [card], undefined, NOW)).toBe("off");
  });
});

describe("canPublish and lead capture follow the account's live cards", () => {
  it("allows a first publish with a free slot and refuses one without", () => {
    const draft = profile({ status: "draft", publishedContent: null });
    expect(canPublish(draft, [draft], [card], NOW)).toBe(true);
    expect(canPublish(draft, [draft], [], NOW)).toBe(false);
    const other = profile({ id: "p2", slug: "two" });
    expect(canPublish(draft, [draft, other], [card], NOW)).toBe(false);
  });

  it("always allows republishing a live profile", () => {
    const p = profile();
    expect(canPublish(p, [p], [], NOW)).toBe(true);
  });

  it("allows the lead form only with a live card", () => {
    expect(leadCaptureAllowed([card], NOW)).toBe(true);
    expect(leadCaptureAllowed([], NOW)).toBe(false);
    expect(leadCaptureAllowed([{ ...card, status: "disabled" }], NOW)).toBe(false);
  });
});

describe("drafts", () => {
  it("sends every action with its id, including types this app does not know", () => {
    const p = profile({ blocks: [ACTION, { id: "a2", type: "spotify", label: "Listen", value: "x", isActive: true }] });
    const input = draftInput(draftFromProfile(p), "v1");
    expect(input).toEqual({
      expectedUpdatedAt: "v1",
      title: "Mama Njeri's",
      redirectUrl: "",
      config: { bio: "Coffee" },
      theme: {},
      blocks: [ACTION, { id: "a2", type: "spotify", label: "Listen", value: "x", isActive: true }],
    });
  });

  it("caches a saved draft exactly as typed, so the editor never edits under the thumb", () => {
    const p = profile();
    // Someone paused after a space: the save must not take it away.
    const draft = { ...draftFromProfile(p), title: "Mama " };
    const saved = withSavedDraft(p, draft, "v2");
    expect(saved).toMatchObject({ title: "Mama ", updatedAt: "v2" });
    expect(saved.publishedContent).toBe(p.publishedContent);
    expect(withSavedDraft(p, { ...draft, title: "  " }, "v3").title).toBeNull();
    // ...and trailing space is not a change customers would see.
    expect(profileStatus(withSavedDraft(p, { ...draftFromProfile(p), title: "Mama Njeri's " }, "v4"), [p], [card], undefined, NOW)).toBe("live");
  });

  it("previews the draft in display order, hidden actions included but marked", () => {
    const p = profile();
    const page = previewPage(p, {
      ...draftFromProfile(p),
      blocks: [{ ...ACTION, isActive: false }, { id: "a2", type: "call", label: "", value: "0722", isActive: true }],
    });
    expect(page.links.map((l) => [l.id, l.sort_order, l.is_active])).toEqual([
      ["a1", 0, false],
      ["a2", 1, true],
    ]);
  });
});

describe("livePage", () => {
  it("reads the published snapshot", () => {
    expect(livePage(profile())).toMatchObject({
      title: "Mama Njeri's",
      config: { bio: "Coffee" },
      links: [{ id: "a1", type: "whatsapp", label: "Chat", sort_order: 0 }],
    });
  });

  it("is null before the first publish, and survives a snapshot of an odd shape", () => {
    expect(livePage(profile({ publishedContent: null }))).toBeNull();
    const odd = livePage(profile({ publishedContent: { title: 5, config: [], links: [null, { type: 7 }] } }));
    expect(odd).toMatchObject({ title: null, config: {}, links: [{ type: "custom" }, { type: "custom" }] });
  });
});

describe("addresses", () => {
  it("builds the public link and the QR target the web's endpoint uses", () => {
    expect(profileUrl("mama-njeri")).toBe("https://taptap.example/mama-njeri");
    expect(qrTarget("mama-njeri")).toBe("https://taptap.example/mama-njeri?src=qr");
  });
});

describe("pickProfile", () => {
  const a = profile({ id: "a", status: "draft" });
  const b = profile({ id: "b" });
  const c = profile({ id: "c" });

  it("prefers the remembered one, then the first live, then the first", () => {
    expect(pickProfile([a, b, c], "c")?.id).toBe("c");
    expect(pickProfile([a, b, c], null)?.id).toBe("b");
    expect(pickProfile([a, b, c], "deleted")?.id).toBe("b");
    expect(pickProfile([a], null)?.id).toBe("a");
    expect(pickProfile([], null)).toBeNull();
  });
});
