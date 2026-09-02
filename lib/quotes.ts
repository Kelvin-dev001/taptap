/**
 * Corporate quote requests (D-021).
 *
 * Vocabulary only, and pure, so the ops console and the server action share one
 * definition — a `"use server"` module may export nothing but async functions,
 * so this cannot live beside the action that uses it.
 *
 * Deliberately NOT a state machine. An order has constrained transitions worth
 * enforcing (D-019); a quote does not, because "we called them and it went
 * nowhere" can happen from any state and back again. Modelling one here would be
 * inventing rules that do not exist, which is worse than having none.
 */

export const QUOTE_STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;

export type QuoteStatusValue = (typeof QUOTE_STATUSES)[number];

export function isQuoteStatus(value: string): value is QuoteStatusValue {
  return (QUOTE_STATUSES as readonly string[]).includes(value);
}

/** Requests still owed a reply. What the console counts, and why it counts it. */
export const OPEN_QUOTE_STATUSES: readonly QuoteStatusValue[] = ["new", "contacted"];

export function isOpenQuote(status: string): boolean {
  return (OPEN_QUOTE_STATUSES as readonly string[]).includes(status);
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatusValue, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

export const QUOTE_STATUS_TONE: Record<
  QuoteStatusValue,
  "brand" | "warning" | "success" | "neutral"
> = {
  new: "brand",
  contacted: "warning",
  quoted: "warning",
  won: "success",
  lost: "neutral",
};
