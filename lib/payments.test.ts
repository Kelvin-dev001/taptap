import { describe, it, expect } from "vitest";
import {
  mpesaReceiptNumber,
  mpesaTransactionDate,
  isPaymentStatus,
  PAYMENT_STATUS_META,
} from "./payments";

/** The shape Daraja actually posts back on a successful STK push. */
const callback = {
  Body: {
    stkCallback: {
      CheckoutRequestID: "ws_CO_123",
      ResultCode: 0,
      CallbackMetadata: {
        Item: [
          { Name: "Amount", Value: 15000 },
          { Name: "MpesaReceiptNumber", Value: "SFG7HJ2K1L" },
          { Name: "TransactionDate", Value: 20260815143022 },
          { Name: "PhoneNumber", Value: 254712345678 },
        ],
      },
    },
  },
};

describe("mpesaReceiptNumber", () => {
  it("extracts the receipt number", () => {
    expect(mpesaReceiptNumber(callback)).toBe("SFG7HJ2K1L");
  });

  it("returns null for a failed callback with no metadata", () => {
    expect(
      mpesaReceiptNumber({ Body: { stkCallback: { ResultCode: 1032 } } }),
    ).toBeNull();
  });

  it("survives junk without throwing", () => {
    for (const input of [null, undefined, {}, [], "string", 42, { Body: null }]) {
      expect(mpesaReceiptNumber(input)).toBeNull();
    }
  });

  /**
   * The stored callback also contains the payer's phone number. Nothing in this
   * module returns the raw object, so a receipt view cannot leak the rest of
   * the payload by accident.
   */
  it("exposes only the receipt number, never the whole payload", () => {
    const value = mpesaReceiptNumber(callback);
    expect(String(value)).not.toContain("254712345678");
  });
});

describe("mpesaTransactionDate", () => {
  it("parses the yyyyMMddHHmmss format Daraja uses", () => {
    const date = mpesaTransactionDate(callback)!;
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7); // August, zero-indexed
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(30);
  });

  it("accepts the value as a string as well as a number", () => {
    const asString = {
      Body: {
        stkCallback: {
          CallbackMetadata: { Item: [{ Name: "TransactionDate", Value: "20260815143022" }] },
        },
      },
    };
    expect(mpesaTransactionDate(asString)?.getFullYear()).toBe(2026);
  });

  it("returns null on a malformed or missing date", () => {
    expect(mpesaTransactionDate({})).toBeNull();
    expect(
      mpesaTransactionDate({
        Body: { stkCallback: { CallbackMetadata: { Item: [{ Name: "TransactionDate", Value: "2026" }] } } },
      }),
    ).toBeNull();
  });
});

describe("payment status", () => {
  it("accepts only known statuses", () => {
    expect(isPaymentStatus("paid")).toBe(true);
    expect(isPaymentStatus("pending")).toBe(true);
    expect(isPaymentStatus("failed")).toBe(true);
    expect(isPaymentStatus("refunded")).toBe(false);
  });

  it("explains what each status means to a non-technical owner", () => {
    for (const meta of Object.values(PAYMENT_STATUS_META)) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
    expect(PAYMENT_STATUS_META.pending.description).toMatch(/PIN/);
  });
});
