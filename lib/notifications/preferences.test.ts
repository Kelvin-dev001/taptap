import { describe, it, expect } from "vitest";
import { leadEmailEnabled, leadEmailRecipient } from "./notify-lead";

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
