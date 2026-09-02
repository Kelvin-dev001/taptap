import { describe, it, expect } from "vitest";
import {
  resolvePaymentState,
  secondsRemaining,
  shouldOfferManual,
  WAIT_SECONDS,
  ATTEMPTS_BEFORE_MANUAL,
  PHASE_COPY,
} from "./checkout";

/**
 * The states an M-Pesa payment can be seen in.
 *
 * Before Sprint 7 there was exactly one: "check your phone", forever. Every
 * assertion here is a spinner that used to never stop.
 */
describe("resolvePaymentState", () => {
  it("waits while nothing has resolved", () => {
    expect(resolvePaymentState({ paymentStatus: "pending", elapsedSeconds: 10 })).toEqual({
      phase: "prompting",
      settled: false,
    });
  });

  it("resolves from our own row without asking Daraja", () => {
    expect(resolvePaymentState({ paymentStatus: "paid", elapsedSeconds: 4 })).toEqual({
      phase: "paid",
      settled: true,
    });
    expect(resolvePaymentState({ paymentStatus: "failed", elapsedSeconds: 4 })).toEqual({
      phase: "failed",
      settled: true,
    });
  });

  it("resolves from Daraja when our row is still pending", () => {
    expect(
      resolvePaymentState({ paymentStatus: "pending", daraja: "paid", elapsedSeconds: 8 }).phase,
    ).toBe("paid");
    expect(
      resolvePaymentState({ paymentStatus: "pending", daraja: "failed", elapsedSeconds: 8 })
        .phase,
    ).toBe("failed");
  });

  /**
   * Daraja answers "still processing" as an error object with no ResultCode
   * while the prompt is on the phone. Treating that as a failure would tell
   * someone their payment had failed while they were typing their PIN.
   */
  it("keeps waiting when Daraja has no verdict", () => {
    expect(
      resolvePaymentState({ paymentStatus: "pending", daraja: "unknown", elapsedSeconds: 20 })
        .phase,
    ).toBe("prompting");
  });

  it("gives up at the ceiling", () => {
    expect(
      resolvePaymentState({ paymentStatus: "pending", elapsedSeconds: WAIT_SECONDS }).phase,
    ).toBe("timed_out");
    expect(
      resolvePaymentState({ paymentStatus: "pending", elapsedSeconds: WAIT_SECONDS + 60 })
        .settled,
    ).toBe(true);
  });

  /**
   * The ordering bug this guards against: a success arriving at 119 seconds
   * must read as a success, not be overwritten by the clock a second later.
   */
  it("prefers a late success over the timeout", () => {
    expect(
      resolvePaymentState({ paymentStatus: "paid", elapsedSeconds: WAIT_SECONDS + 30 }).phase,
    ).toBe("paid");
    expect(
      resolvePaymentState({
        paymentStatus: "pending",
        daraja: "paid",
        elapsedSeconds: WAIT_SECONDS + 30,
      }).phase,
    ).toBe("paid");
  });

  it("treats a missing payment row as still waiting", () => {
    expect(resolvePaymentState({ paymentStatus: null, elapsedSeconds: 2 }).phase).toBe(
      "prompting",
    );
  });
});

describe("the countdown", () => {
  it("counts down and stops at zero", () => {
    expect(secondsRemaining(0)).toBe(WAIT_SECONDS);
    expect(secondsRemaining(WAIT_SECONDS - 30)).toBe(30);
    expect(secondsRemaining(WAIT_SECONDS + 45)).toBe(0);
  });
});

describe("the manual fallback", () => {
  /**
   * Not on the first failure. A wrong PIN or a cancelled prompt is usually
   * fixed by trying again, and leading with "pay us by Paybill instead" turns a
   * two-second retry into a five-minute errand.
   */
  it("is withheld until retrying has actually been tried", () => {
    expect(shouldOfferManual(1, "failed")).toBe(false);
    expect(shouldOfferManual(ATTEMPTS_BEFORE_MANUAL, "failed")).toBe(true);
  });

  it("is offered after a timeout as well as a failure", () => {
    expect(shouldOfferManual(2, "timed_out")).toBe(true);
  });

  it("is never offered while a prompt is still live or already paid", () => {
    expect(shouldOfferManual(5, "prompting")).toBe(false);
    expect(shouldOfferManual(5, "paid")).toBe(false);
  });
});

describe("what the customer is told", () => {
  /**
   * A timeout is not a failure and must not be worded as one. The prompt may
   * still be sitting on the phone, and the callback may still land, so the copy
   * has to leave that door open rather than implying the money is gone.
   */
  it("does not tell someone a timed-out payment failed", () => {
    expect(PHASE_COPY.timed_out.body).toMatch(/nothing has been lost/i);
    expect(PHASE_COPY.timed_out.tone).toBe("warning");
    expect(PHASE_COPY.failed.tone).toBe("danger");
  });

  it("says plainly that a failed payment charged nothing", () => {
    expect(PHASE_COPY.failed.body).toMatch(/nothing has been charged/i);
  });

  /** House style: no em dashes in anything a customer reads. */
  it("uses no em dash", () => {
    for (const copy of Object.values(PHASE_COPY)) {
      expect(copy.title).not.toContain("—");
      expect(copy.body).not.toContain("—");
    }
  });
});
