import { describe, it, expect } from "vitest";
import {
  milestoneFor,
  renewalDedupeKey,
  composeRenewalEmail,
  type IdentityForEmail,
} from "./renewal-email";
import { GRACE_DAYS, RENEWAL_WARNING_DAYS } from "@/lib/pricing";

const NOW = new Date("2026-08-30T12:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe("milestoneFor", () => {
  it("says nothing while the term is comfortably in the future", () => {
    expect(milestoneFor(inDays(90), NOW)).toBeNull();
    expect(milestoneFor(inDays(RENEWAL_WARNING_DAYS + 1), NOW)).toBeNull();
  });

  it("walks through the four moments", () => {
    expect(milestoneFor(inDays(RENEWAL_WARNING_DAYS), NOW)).toBe("T30");
    expect(milestoneFor(inDays(8), NOW)).toBe("T30");
    expect(milestoneFor(inDays(7), NOW)).toBe("T7");
    expect(milestoneFor(inDays(1), NOW)).toBe("T7");
    expect(milestoneFor(inDays(-1), NOW)).toBe("T0");
    expect(milestoneFor(inDays(-(GRACE_DAYS - 1)), NOW)).toBe("T0");
    expect(milestoneFor(inDays(-GRACE_DAYS), NOW)).toBe("stopped");
    expect(milestoneFor(inDays(-90), NOW)).toBe("stopped");
  });

  /**
   * The milestones are windows, not exact days, so a cron outage self-heals:
   * a run missed on day 30 still sends the T30 notice on day 29.
   */
  it("covers every day in each window, leaving no gap", () => {
    for (let d = RENEWAL_WARNING_DAYS; d > -GRACE_DAYS - 5; d--) {
      expect(milestoneFor(inDays(d), NOW)).not.toBeNull();
    }
  });

  it("says nothing about a device with no term", () => {
    expect(milestoneFor(null, NOW)).toBeNull();
    expect(milestoneFor("not-a-date", NOW)).toBeNull();
  });
});

describe("renewalDedupeKey", () => {
  /**
   * The whole point: a card renewed for another year must be able to receive
   * next year's notices. Keying on device + milestone alone would silence it
   * permanently after year one.
   */
  it("differs between terms for the same device and milestone", () => {
    const a = renewalDedupeKey("tag-1", "2027-08-30T00:00:00Z", "T30");
    const b = renewalDedupeKey("tag-1", "2028-08-30T00:00:00Z", "T30");
    expect(a).not.toBe(b);
  });

  it("is stable for the same device, term and milestone", () => {
    expect(renewalDedupeKey("tag-1", "2027-08-30T00:00:00Z", "T7")).toBe(
      renewalDedupeKey("tag-1", "2027-08-30T09:30:00Z", "T7"),
    );
  });

  it("differs between milestones and between devices", () => {
    const base = renewalDedupeKey("tag-1", "2027-08-30T00:00:00Z", "T30");
    expect(base).not.toBe(renewalDedupeKey("tag-1", "2027-08-30T00:00:00Z", "T7"));
    expect(base).not.toBe(renewalDedupeKey("tag-2", "2027-08-30T00:00:00Z", "T30"));
  });
});

describe("composeRenewalEmail", () => {
  const identity = (over: Partial<IdentityForEmail> = {}): IdentityForEmail => ({
    id: "tag-1",
    label: "Reception",
    kind: "card",
    termEnd: "2027-09-30T00:00:00Z",
    ...over,
  });

  const compose = (milestone: Parameters<typeof composeRenewalEmail>[0]["milestone"], identities: IdentityForEmail[]) =>
    composeRenewalEmail({
      businessName: "Magangi & Company",
      milestone,
      identities,
      siteUrl: "https://taptap.hornbilltech.co.ke",
    });

  it("prices the renewal as count times the per-device price", () => {
    const one = compose("T30", [identity()]);
    expect(one.text).toContain("1 × KES 1,000 = KES 1,000");

    const three = compose("T30", [
      identity({ id: "a" }),
      identity({ id: "b" }),
      identity({ id: "c" }),
    ]);
    expect(three.text).toContain("3 × KES 1,000 = KES 3,000");
  });

  it("names each device and its own date", () => {
    const email = compose("T30", [
      identity({ id: "a", label: "Reception", termEnd: "2027-09-30T00:00:00Z" }),
      identity({ id: "b", label: "Till", termEnd: "2027-10-15T00:00:00Z" }),
    ]);
    expect(email.text).toContain("Reception — 30 September 2027");
    expect(email.text).toContain("Till — 15 October 2027");
  });

  it("falls back to the device type when a card has no label", () => {
    expect(compose("T30", [identity({ label: null })]).text).toContain("Smart Card");
    expect(compose("T30", [identity({ label: null, kind: "stand" })]).text).toContain(
      "Smart Stand",
    );
  });

  /** The earliest date is the one that matters — it stops first. */
  it("leads on the earliest date when several are due", () => {
    const email = compose("T30", [
      identity({ id: "a", termEnd: "2027-10-15T00:00:00Z" }),
      identity({ id: "b", termEnd: "2027-09-30T00:00:00Z" }),
    ]);
    expect(email.subject).toContain("30 September 2027");
  });

  it("gets more urgent as the date approaches", () => {
    expect(compose("T30", [identity()]).subject).toMatch(/renews on/i);
    expect(compose("T7", [identity()]).subject).toMatch(/7 days/i);
    expect(compose("T0", [identity()]).subject).toMatch(/due today/i);
    expect(compose("stopped", [identity()]).subject).toMatch(/stopped working/i);
  });

  /**
   * The reassurance is the most important sentence in the harshest email: an
   * owner whose card just died needs to know their content is not gone.
   */
  it("promises nothing is deleted once a card has stopped", () => {
    const email = compose("stopped", [identity()]);
    expect(email.text).toMatch(/nothing has been deleted/i);
    expect(email.text).toMatch(/brings it back/i);
  });

  it("states the grace period while there is still one", () => {
    expect(compose("T7", [identity()]).text).toContain(`${GRACE_DAYS} days`);
    expect(compose("T0", [identity()]).text).toContain(`${GRACE_DAYS} days`);
  });

  it("links to billing and repeats the no-auto-renew facts", () => {
    const email = compose("T30", [identity()]);
    expect(email.text).toContain("https://taptap.hornbilltech.co.ke/dashboard/billing");
    expect(email.html).toContain("https://taptap.hornbilltech.co.ke/dashboard/billing");
    expect(email.text).toMatch(/nothing renews\s+automatically/i);
  });

  it("uses singular and plural correctly", () => {
    expect(compose("T30", [identity()]).subject).toContain("card renews");
    expect(compose("T30", [identity({ id: "a" }), identity({ id: "b" })]).subject).toContain(
      "cards renew",
    );
  });

  /** A label is owner-supplied and lands inside an HTML document. */
  it("escapes a device label into the HTML", () => {
    const email = compose("T30", [identity({ label: '<script>alert(1)</script>' })]);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});
