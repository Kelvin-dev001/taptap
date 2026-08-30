import { describe, it, expect } from "vitest";
import {
  leadEmailEnabled,
  leadEmailRecipient,
  mergeNotifyPrefs,
} from "./preferences";

describe("leadEmailEnabled", () => {
  /**
   * Opt-out, not opt-in. A business that has never opened Settings is exactly
   * the one that most needs telling a lead arrived — the gap this sprint
   * closes. Defaulting to off would ship the feature and change nothing.
   */
  it("is on when nothing has been configured", () => {
    expect(leadEmailEnabled(null)).toBe(true);
    expect(leadEmailEnabled({})).toBe(true);
    expect(leadEmailEnabled({ lead: {} })).toBe(true);
  });

  it("is on when explicitly enabled", () => {
    expect(leadEmailEnabled({ lead: { enabled: true } })).toBe(true);
  });

  it("is off only when explicitly disabled", () => {
    expect(leadEmailEnabled({ lead: { enabled: false } })).toBe(false);
  });
});

describe("leadEmailRecipient", () => {
  it("uses the owner's sign-up address by default", () => {
    expect(
      leadEmailRecipient({ notify: {}, ownerEmail: "owner@macauditcpa.co.ke" }),
    ).toBe("owner@macauditcpa.co.ke");
  });

  it("prefers an address the account chose", () => {
    expect(
      leadEmailRecipient({
        notify: { lead: { to: "leads@macauditcpa.co.ke" } },
        ownerEmail: "owner@macauditcpa.co.ke",
      }),
    ).toBe("leads@macauditcpa.co.ke");
  });

  it("ignores a blank or whitespace override", () => {
    expect(
      leadEmailRecipient({ notify: { lead: { to: "   " } }, ownerEmail: "owner@x.co.ke" }),
    ).toBe("owner@x.co.ke");
    expect(
      leadEmailRecipient({ notify: { lead: { to: null } }, ownerEmail: "owner@x.co.ke" }),
    ).toBe("owner@x.co.ke");
  });

  /** No address is a skip, never a send to a guessed one. */
  it("returns null when there is nowhere to send", () => {
    expect(leadEmailRecipient({ notify: {}, ownerEmail: null })).toBeNull();
    expect(leadEmailRecipient({ notify: { lead: { to: "" } }, ownerEmail: "" })).toBeNull();
  });
});

describe("mergeNotifyPrefs", () => {
  /**
   * The bug this exists to prevent: migration 0014 gave `notify` its own column
   * because saveBusinessProfileAction replaces `profile` wholesale — and then
   * the Settings action did the same thing to `notify`. It never lost data only
   * because `lead` happened to be the sole key.
   */
  it("preserves sibling sections the caller did not mention", () => {
    const existing = {
      lead: { enabled: true, to: "leads@macauditcpa.co.ke" },
      renewal: { to: "accounts@macauditcpa.co.ke" },
    };
    const merged = mergeNotifyPrefs(existing, { lead: { enabled: false, to: null } });

    expect(merged.renewal).toEqual({ to: "accounts@macauditcpa.co.ke" });
    expect(merged.lead).toEqual({ enabled: false, to: null });
  });

  it("preserves keys it has never heard of", () => {
    const merged = mergeNotifyPrefs(
      { digest: { weekly: true } },
      { lead: { enabled: true, to: null } },
    );
    expect((merged as Record<string, unknown>).digest).toEqual({ weekly: true });
  });

  /**
   * Sections are replaced, not deep-merged: unchecking a box has to be able to
   * remove a value, and a deep merge would make absence unexpressible.
   */
  it("replaces a section wholesale rather than deep-merging it", () => {
    const merged = mergeNotifyPrefs(
      { lead: { enabled: true, to: "old@example.com" } },
      { lead: { enabled: true, to: null } },
    );
    expect(merged.lead).toEqual({ enabled: true, to: null });
  });

  it("starts from nothing when the column is empty or malformed", () => {
    const patch = { lead: { enabled: true, to: null } };
    expect(mergeNotifyPrefs(null, patch)).toEqual(patch);
    expect(mergeNotifyPrefs(undefined, patch)).toEqual(patch);
    expect(mergeNotifyPrefs({}, patch)).toEqual(patch);
    // Bad data must not throw or spread into character keys.
    expect(mergeNotifyPrefs("nonsense", patch)).toEqual(patch);
    expect(mergeNotifyPrefs([1, 2, 3], patch)).toEqual(patch);
  });

  it("does not mutate what it was given", () => {
    const existing = { lead: { enabled: true, to: "a@b.co" }, renewal: { to: "c@d.co" } };
    const snapshot = JSON.parse(JSON.stringify(existing));
    mergeNotifyPrefs(existing, { lead: { enabled: false, to: null } });
    expect(existing).toEqual(snapshot);
  });

  /** The round trip the reader actually cares about. */
  it("keeps lead settings readable after an unrelated section is added", () => {
    const merged = mergeNotifyPrefs(
      { renewal: { to: "accounts@x.co.ke" } },
      { lead: { enabled: false, to: null } },
    );
    expect(leadEmailEnabled(merged)).toBe(false);
    expect(leadEmailRecipient({ notify: merged, ownerEmail: "owner@x.co.ke" })).toBe(
      "owner@x.co.ke",
    );
  });
});
