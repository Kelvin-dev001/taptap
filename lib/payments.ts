export type PaymentStatus = "pending" | "paid" | "failed";

/** What a payment bought. Null on Sprint 4 rows, which predate the split. */
export type PaymentKind = "hardware" | "renewal";

/**
 * How money reached us when it did not come through M-Pesa (D-021).
 *
 * `payments.provider` has no CHECK constraint and never has, so this list is the
 * only thing keeping it from becoming free text. It lives here rather than in
 * the ops action because a `"use server"` module may only export async
 * functions, and because the ops console and the payment history both need to
 * name these the same way.
 *
 * `mpesa` is deliberately absent: that path is automatic, and offering staff a
 * way to assert an M-Pesa payment by hand would let a callback and a person
 * disagree about the same money.
 */
export const OFFLINE_METHODS = ["cash", "bank", "other"] as const;
export type OfflineMethod = (typeof OFFLINE_METHODS)[number];

export const OFFLINE_METHOD_LABELS: Record<OfflineMethod, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  other: "Other",
};

export function isOfflineMethod(value: string): value is OfflineMethod {
  return (OFFLINE_METHODS as readonly string[]).includes(value);
}

export type PaymentRow = {
  id: string;
  /** Legacy per-account plan code (Sprint 4). Null on per-identity payments. */
  plan_code?: string | null;
  kind?: PaymentKind | string | null;
  quantity?: number | null;
  provider: string;
  reference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  created_at: string;
  raw?: unknown;
};

/**
 * A one-line description of what a payment was for.
 *
 * Receipts and history both need it, and they must agree — a receipt that
 * describes a payment differently from the row it came from is the kind of
 * discrepancy that turns into a support conversation about whether money moved.
 */
export function describePayment(p: PaymentRow): string {
  const count = p.quantity && p.quantity > 0 ? p.quantity : 1;

  if (p.kind === "renewal") {
    return count === 1
      ? "Annual renewal · 1 device"
      : `Annual renewal · ${count} devices`;
  }
  if (p.kind === "hardware") {
    return count === 1
      ? "Device purchase · includes 12 months"
      : `Device purchase (${count}) · includes 12 months`;
  }
  // Pre-D-018 rows carry a plan code and nothing else.
  return p.plan_code ? `${p.plan_code} plan · 12 months` : "Payment";
}

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
