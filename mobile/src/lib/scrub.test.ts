import { scrubDeep, scrubText } from "./scrub";

// A synthetic token assembled at runtime, so the source never contains a
// JWT-shaped literal for a secret scanner to trip over.
const FAKE_JWT = [
  "eyJ" + "hbGciOiJIUzI1NiJ9",
  "eyJ" + "zdWIiOiJ0ZXN0In0",
  "c2lnbmF0dXJlLXRlc3Q",
].join(".");

describe("scrubText", () => {
  it.each([
    ["Lead from jane@acme.co.ke failed", "Lead from [email] failed"],
    ["Call 0712 345 678 back", "Call [phone] back"],
    ["Call 0712345678", "Call [phone]"],
    ["Safaricom 0112345678", "Safaricom [phone]"],
    ["+254 712 345 678 left details", "[phone] left details"],
    ["254712345678", "[phone]"],
    ["+44 20 7946 0958", "[phone]"],
    ["token 0123456789abcdef0123456789abcdef", "token [token]"],
    [`Bearer ${FAKE_JWT}`, "Bearer [jwt]"],
  ])("%s", (input, expected) => {
    expect(scrubText(input)).toBe(expected);
  });

  it("leaves ordinary text alone", () => {
    const text = "TypeError: undefined is not a function (at Home.tsx:42:7) in 2026";
    expect(scrubText(text)).toBe(text);
  });
});

describe("scrubDeep", () => {
  it("scrubs nested strings and keeps everything else", () => {
    const event = {
      message: "Failed for 0712345678",
      extra: { lead: { email: "a@b.co", count: 3, ok: true } },
      breadcrumbs: [{ message: "opened jane@x.com" }],
    };
    expect(scrubDeep(event)).toEqual({
      message: "Failed for [phone]",
      extra: { lead: { email: "[email]", count: 3, ok: true } },
      breadcrumbs: [{ message: "opened [email]" }],
    });
  });
});
