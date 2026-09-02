/**
 * What the customer sees while an M-Pesa prompt is on their phone.
 *
 * Pure, so the states a payment can be in are decidable without a network — the
 * same split as `lib/orders.ts`. The interesting cases here are all shapes of
 * response rather than shapes of request, and every one of them used to be
 * unhandled: before Sprint 7 the checkout said "check your phone" and never
 * found out what happened.
 */

import type { StkOutcome } from "./mpesa";

/** How often the browser asks. Below this, Daraja starts rate limiting. */
export const POLL_INTERVAL_MS = 3_000;

/**
 * How long to keep asking.
 *
 * An STK prompt expires on the handset at about 60 seconds. The extra minute is
 * for the gap between the customer entering their PIN and Safaricom's
 * confirmation reaching us, which on a busy evening is genuinely tens of
 * seconds.
 */
export const WAIT_SECONDS = 120;

/** After this many failed attempts, offer the Paybill instead of a third prompt. */
export const ATTEMPTS_BEFORE_MANUAL = 2;

export type CheckoutPhase =
  /** Nothing started. */
  | "idle"
  /** Prompt sent, waiting on the customer and on Safaricom. */
  | "prompting"
  /** Confirmed. The identity exists. */
  | "paid"
  /** Safaricom said no: wrong PIN, cancelled, no money. */
  | "failed"
  /** We stopped asking. The payment may still land; nothing has been lost. */
  | "timed_out";

export type PollInput = {
  /** What our own `payments` row says. The callback may already have landed. */
  paymentStatus: "pending" | "paid" | "failed" | null;
  /** What Daraja said when asked, if it was asked. */
  daraja?: StkOutcome["state"] | null;
  elapsedSeconds: number;
};

export type PollState = {
  phase: CheckoutPhase;
  /** True once there is nothing left to wait for. */
  settled: boolean;
};

/**
 * Decide what to show.
 *
 * Order matters. Our own row is consulted first, so a landed callback resolves
 * the screen without a Daraja round trip; and the timeout is checked LAST, so a
 * success arriving at 119 seconds still reads as a success rather than being
 * overwritten by the clock.
 */
export function resolvePaymentState(input: PollInput): PollState {
  if (input.paymentStatus === "paid") return { phase: "paid", settled: true };
  if (input.paymentStatus === "failed") return { phase: "failed", settled: true };

  if (input.daraja === "paid") return { phase: "paid", settled: true };
  if (input.daraja === "failed") return { phase: "failed", settled: true };

  if (input.elapsedSeconds >= WAIT_SECONDS) return { phase: "timed_out", settled: true };

  return { phase: "prompting", settled: false };
}

/** Seconds left on the clock, floored at zero. */
export function secondsRemaining(elapsedSeconds: number): number {
  return Math.max(0, Math.ceil(WAIT_SECONDS - elapsedSeconds));
}

/**
 * Should the Paybill fallback be offered?
 *
 * Not on the first failure. A wrong PIN or a cancelled prompt is usually fixed
 * by trying again, and leading with "pay us manually instead" on attempt one
 * turns a two-second retry into a five-minute errand.
 */
export function shouldOfferManual(attempts: number, phase: CheckoutPhase): boolean {
  if (phase !== "failed" && phase !== "timed_out") return false;
  return attempts >= ATTEMPTS_BEFORE_MANUAL;
}

export const PHASE_COPY: Record<
  Exclude<CheckoutPhase, "idle">,
  { title: string; body: string; tone: "info" | "success" | "danger" | "warning" }
> = {
  prompting: {
    title: "Check your phone",
    body: "Enter your M-Pesa PIN on the prompt we just sent. This screen updates on its own.",
    tone: "info",
  },
  paid: {
    title: "Payment received",
    body: "Your identity is active and your profile can go live.",
    tone: "success",
  },
  failed: {
    title: "The payment did not go through",
    body: "Nothing has been charged. You can send the prompt again.",
    tone: "danger",
  },
  timed_out: {
    title: "We stopped waiting",
    body: "The prompt may still be on your phone. If you paid, this will update on its own within a few minutes and nothing has been lost.",
    tone: "warning",
  },
};
