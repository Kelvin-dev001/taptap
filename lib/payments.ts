export type PaymentStatus = "pending" | "paid" | "failed";

export type PaymentRow = {
  id: string;
  plan_code: string;
  provider: string;
  reference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  created_at: string;
  raw?: unknown;
};

/**
 * Pull the M-Pesa receipt number out of a stored Daraja callback.
 *
 * `payments.raw` holds the whole callback, which also contains the payer's
 * phone number. Nothing here returns the raw object — only the two fields a
 * receipt legitimately needs — so a receipt view cannot accidentally leak the
 * rest of the payload.
 *
 * Shape: Body.stkCallback.CallbackMetadata.Item[] of { Name, Value }.
 */
export function mpesaReceiptNumber(raw: unknown): string | null {
  const items = callbackItems(raw);
  const found = items.find((i) => i.Name === "MpesaReceiptNumber");
  return typeof found?.Value === "string" ? found.Value : null;
}

/** Transaction time as reported by Daraja (yyyyMMddHHmmss), if present. */
export function mpesaTransactionDate(raw: unknown): Date | null {
  const items = callbackItems(raw);
  const found = items.find((i) => i.Name === "TransactionDate");
  const value = found?.Value;
  const digits = value == null ? "" : String(value);
  if (!/^\d{14}$/.test(digits)) return null;

  const date = new Date(
    Number(digits.slice(0, 4)),
    Number(digits.slice(4, 6)) - 1,
    Number(digits.slice(6, 8)),
    Number(digits.slice(8, 10)),
    Number(digits.slice(10, 12)),
    Number(digits.slice(12, 14)),
  );
  return Number.isFinite(date.getTime()) ? date : null;
}

type CallbackItem = { Name?: string; Value?: unknown };

function callbackItems(raw: unknown): CallbackItem[] {
  if (!raw || typeof raw !== "object") return [];
  const body = (raw as { Body?: { stkCallback?: { CallbackMetadata?: { Item?: unknown } } } }).Body;
  const item = body?.stkCallback?.CallbackMetadata?.Item;
  return Array.isArray(item) ? (item as CallbackItem[]) : [];
}

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; tone: "success" | "warning" | "danger"; description: string }
> = {
  paid: { label: "Paid", tone: "success", description: "Payment confirmed by M-Pesa" },
  pending: {
    label: "Pending",
    tone: "warning",
    // A pending row is normal for a few minutes and permanent if the customer
    // never entered their PIN — saying so avoids a support message.
    description: "Waiting for the M-Pesa PIN prompt to be completed",
  },
  failed: { label: "Failed", tone: "danger", description: "M-Pesa reported the payment failed" },
};

export function isPaymentStatus(value: string): value is PaymentStatus {
  return value === "pending" || value === "paid" || value === "failed";
}
