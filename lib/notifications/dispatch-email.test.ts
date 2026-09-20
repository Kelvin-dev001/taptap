import { describe, it, expect } from "vitest";
import { composeDispatchEmail, type DispatchEmailInput } from "./dispatch-email";

const base: DispatchEmailInput = {
  businessName: "Magangi & Company",
  orderNumber: "TT012",
  quantity: 1,
  productName: "Standard Card",
  method: "rider",
  reference: "Peter 0712 345 678",
  destination: "Nyali, Mombasa",
  siteUrl: "https://taptap.hornbilltech.co.ke",
};

/**
 * The reference is the whole point of this email.
 *
 * A customer who knows a parcel has left learns nothing they can act on. One who
 * has the rider's number can phone the person holding it. If the reference ever
 * stops reaching the email, the email stops being worth sending.
 */
describe("composeDispatchEmail", () => {
  it("carries the reference in both the text and the HTML", () => {
    const email = composeDispatchEmail(base);
    expect(email.text).toContain("Peter 0712 345 678");
    expect(email.html).toContain("Peter 0712 345 678");
  });

  it("labels the reference by what it actually is", () => {
    expect(composeDispatchEmail(base).text).toMatch(/rider name and phone/i);
    expect(
      composeDispatchEmail({ ...base, method: "courier", reference: "AWB-99217" }).text,
    ).toMatch(/waybill number/i);
    expect(
      composeDispatchEmail({ ...base, method: "shuttle", reference: "Simba 4471" }).text,
    ).toMatch(/shuttle and parcel reference/i);
  });

  /**
   * Staff can dispatch without a reference (a rider they will name later). The
   * email must then say so rather than leaving a heading over a blank.
   */
  it("says the tracking is coming when there is no reference", () => {
    for (const reference of [null, "", "   "]) {
      const email = composeDispatchEmail({ ...base, reference });
      expect(email.text).toMatch(/tracking details shortly/i);
      expect(email.text).not.toMatch(/rider name and phone:\s*$/im);
    }
  });

  it("tells them where it is going when we know", () => {
    expect(composeDispatchEmail(base).text).toContain("Nyali, Mombasa");
  });

  it("reads sensibly when we do not", () => {
    const email = composeDispatchEmail({ ...base, destination: null });
    expect(email.text).toContain("on its way");
    expect(email.text).not.toContain("on its way to .");
    expect(email.text).not.toContain("null");
  });

  it("names the order and the business", () => {
    const email = composeDispatchEmail(base);
    expect(email.text).toContain("TT012");
    expect(email.text).toContain("Magangi & Company");
  });

  /** The customer has to know how to use the thing when it lands. */
  it("carries the first-tap instructions for all three phone cases", () => {
    const email = composeDispatchEmail(base);
    expect(email.text).toMatch(/android/i);
    expect(email.text).toMatch(/iphone/i);
    expect(email.text).toMatch(/scan the qr/i);
  });

  it("links to the orders page, without a doubled slash", () => {
    const email = composeDispatchEmail({ ...base, siteUrl: "https://example.com/" });
    expect(email.text).toContain("https://example.com/dashboard/orders");
    expect(email.text).not.toContain("example.com//dashboard");
  });

  it("speaks of a card for one and an order for several", () => {
    expect(composeDispatchEmail(base).subject).toMatch(/card is on its way/i);
    expect(composeDispatchEmail({ ...base, quantity: 3 }).subject).toMatch(
      /order is on its way/i,
    );
    expect(composeDispatchEmail({ ...base, quantity: 3 }).text).toContain("3 ×");
  });

  /** Anything a customer typed reaches the HTML, so it has to be escaped. */
  it("escapes what came from a person", () => {
    const email = composeDispatchEmail({
      ...base,
      businessName: '<script>alert("x")</script>',
      reference: "Peter <b>0712</b>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>0712</b>");
  });

  /** Customer copy. No em dashes. */
  it("uses no em dashes", () => {
    const email = composeDispatchEmail(base);
    expect(email.subject).not.toContain("—");
    expect(email.text).not.toContain("—");
  });
});
