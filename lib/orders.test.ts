import { describe, it, expect } from "vitest";
import {
  ORDER_STATUSES,
  FULFILMENT_PIPELINE,
  ORDER_STATUS_META,
  isOrderStatus,
  canTransition,
  allowedTransitions,
  nextStatus,
  isTerminal,
  customerFacingStatus,
  requiresPayment,
  transitionBlockedReason,
  availableTransitions,
  UNPAID_CEILING,
  daysAtStage,
  isStuck,
  pipelineProgress,
  PRODUCT_KIND,
  type OrderStatus,
} from "./orders";

const NOW = new Date("2026-08-30T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("status vocabulary", () => {
  it("recognises only known statuses", () => {
    expect(isOrderStatus("in_production")).toBe(true);
    expect(isOrderStatus("shipped")).toBe(false);
    expect(isOrderStatus(null)).toBe(false);
    expect(isOrderStatus(undefined)).toBe(false);
  });

  /** Non-colour status communication is a WCAG 2.2 requirement (§24). */
  it("gives every status a label and a description", () => {
    for (const status of ORDER_STATUSES) {
      const meta = ORDER_STATUS_META[status];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.customerLabel.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it("keeps the happy path inside the status list", () => {
    for (const status of FULFILMENT_PIPELINE) {
      expect(ORDER_STATUSES).toContain(status);
    }
  });
});

describe("transitions", () => {
  it("walks the happy path end to end", () => {
    for (let i = 0; i < FULFILMENT_PIPELINE.length - 1; i++) {
      const from = FULFILMENT_PIPELINE[i];
      const to = FULFILMENT_PIPELINE[i + 1];
      expect(canTransition(from, to)).toBe(true);
      expect(nextStatus(from)).toBe(to);
    }
  });

  it("refuses to skip stages", () => {
    expect(canTransition("new", "in_production")).toBe(false);
    expect(canTransition("design", "dispatched")).toBe(false);
    expect(canTransition("approved", "delivered")).toBe(false);
  });

  it("refuses to run backwards along the pipeline", () => {
    expect(canTransition("in_production", "design")).toBe(false);
    expect(canTransition("delivered", "dispatched")).toBe(false);
  });

  /** QC failing sends work back to the bench; that is a loop, not a skip. */
  it("allows the two loops that real production needs", () => {
    expect(canTransition("awaiting_approval", "revision_requested")).toBe(true);
    expect(canTransition("revision_requested", "design")).toBe(true);
    expect(canTransition("qc", "in_production")).toBe(true);
  });

  /**
   * Cancelling is possible until the thing is in someone's hand. After that it
   * is a refund conversation, not a status change — and pretending otherwise
   * would let a click switch off a card a customer is holding.
   */
  it("allows cancellation up to dispatch and never after", () => {
    const cancellable: OrderStatus[] = [
      "new",
      "content_received",
      "design",
      "awaiting_approval",
      "revision_requested",
      "approved",
      "in_production",
      "qc",
      "ready_for_dispatch",
    ];
    for (const status of cancellable) {
      expect(canTransition(status, "cancelled")).toBe(true);
    }
    expect(canTransition("dispatched", "cancelled")).toBe(false);
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });

  it("treats delivered and cancelled as terminal", () => {
    expect(isTerminal("delivered")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(allowedTransitions("delivered")).toEqual([]);
    expect(isTerminal("new")).toBe(false);
    expect(nextStatus("delivered")).toBeNull();
  });

  it("has no transition leading to a status that does not exist", () => {
    for (const status of ORDER_STATUSES) {
      for (const target of allowedTransitions(status)) {
        expect(ORDER_STATUSES).toContain(target);
      }
    }
  });

  it("never allows a status to transition to itself", () => {
    for (const status of ORDER_STATUSES) {
      expect(allowedTransitions(status)).not.toContain(status);
    }
  });

  /** Every non-terminal stage must be able to reach an ending. */
  it("leaves no stage with nowhere to go", () => {
    for (const status of ORDER_STATUSES) {
      if (status === "delivered" || status === "cancelled") continue;
      expect(allowedTransitions(status).length).toBeGreaterThan(0);
    }
  });
});

describe("customerFacingStatus", () => {
  /**
   * Fulfilment and payment are separate machines (D-019). An order sits at `new`
   * from the moment it is created, so without the join an unpaid order would
   * tell the customer it was paid.
   */
  it("reports payment before fulfilment while payment is unresolved", () => {
    expect(customerFacingStatus("new", "pending").customerLabel).toBe("Awaiting payment");
    expect(customerFacingStatus("design", "pending").customerLabel).toBe("Awaiting payment");
    expect(customerFacingStatus("new", "failed").customerLabel).toBe("Payment failed");
    expect(customerFacingStatus("new", null).customerLabel).toBe("Payment failed");
  });

  it("reports fulfilment once payment has cleared", () => {
    expect(customerFacingStatus("new", "paid").customerLabel).toBe("Paid");
    expect(customerFacingStatus("in_production", "paid").customerLabel).toBe("Being made");
    expect(customerFacingStatus("delivered", "paid").customerLabel).toBe("Delivered");
  });

  it("reports a cancellation whatever the payment says", () => {
    expect(customerFacingStatus("cancelled", "paid").customerLabel).toBe("Cancelled");
    expect(customerFacingStatus("cancelled", "pending").customerLabel).toBe("Cancelled");
  });

  /** Internal stage names are not customer language. */
  it("does not show a customer the internal label for a workshop stage", () => {
    expect(customerFacingStatus("qc", "paid").customerLabel).not.toBe("QC");
    expect(customerFacingStatus("content_received", "paid").customerLabel).not.toBe(
      "Content received",
    );
  });
});

describe("daysAtStage", () => {
  it("counts from the last change, not from creation", () => {
    expect(daysAtStage(daysAgo(3), daysAgo(30), NOW)).toBe(3);
  });

  it("falls back to creation when nothing has changed yet", () => {
    expect(daysAtStage(null, daysAgo(6), NOW)).toBe(6);
  });

  it("never reports negative time", () => {
    expect(daysAtStage(new Date(NOW.getTime() + 86_400_000).toISOString(), daysAgo(1), NOW)).toBe(0);
    expect(daysAtStage("nonsense", daysAgo(1), NOW)).toBe(0);
  });
});

describe("isStuck", () => {
  const order = (over: Partial<{ status: OrderStatus; updated_at: string | null; created_at: string }> = {}) => ({
    status: "design" as OrderStatus,
    updated_at: daysAgo(9),
    created_at: daysAgo(20),
    ...over,
  });

  it("flags work sitting on our bench", () => {
    expect(isStuck(order(), 5, NOW)).toBe(true);
    expect(isStuck(order({ updated_at: daysAgo(2) }), 5, NOW)).toBe(false);
  });

  it("is exact at the threshold", () => {
    expect(isStuck(order({ updated_at: daysAgo(5) }), 5, NOW)).toBe(true);
    expect(isStuck(order({ updated_at: daysAgo(4) }), 5, NOW)).toBe(false);
  });

  /**
   * The point of the flag is "what needs us". An order waiting on the customer
   * to approve artwork, or in transit, is not our bottleneck — counting those
   * would bury the ones that genuinely are.
   */
  it("does not blame us for time spent waiting on the customer", () => {
    expect(isStuck(order({ status: "awaiting_approval" }), 5, NOW)).toBe(false);
    expect(isStuck(order({ status: "dispatched" }), 5, NOW)).toBe(false);
  });

  it("never flags a finished order", () => {
    expect(isStuck(order({ status: "delivered", updated_at: daysAgo(400) }), 5, NOW)).toBe(false);
    expect(isStuck(order({ status: "cancelled", updated_at: daysAgo(400) }), 5, NOW)).toBe(false);
  });
});

describe("pipelineProgress", () => {
  it("advances along the pipeline and completes on delivery", () => {
    expect(pipelineProgress("new")).toBeGreaterThan(0);
    expect(pipelineProgress("delivered")).toBe(1);
    expect(pipelineProgress("in_production")).toBeGreaterThan(pipelineProgress("design"));
  });

  it("shows a revision as sitting back at design rather than at zero", () => {
    expect(pipelineProgress("revision_requested")).toBe(pipelineProgress("design"));
  });

  it("is zero for a cancelled order", () => {
    expect(pipelineProgress("cancelled")).toBe(0);
  });
});

describe("PRODUCT_KIND", () => {
  it("maps every seeded product to a device kind", () => {
    expect(PRODUCT_KIND.smart_card).toBe("card");
    expect(PRODUCT_KIND.smart_stand).toBe("stand");
  });
});

/**
 * The payment gate.
 *
 * Found in production: TT004 reached `delivered` carrying a FAILED payment,
 * because the board displayed a "Not paid" badge and displaying is not
 * enforcing. In a workshop that is a card designed, encoded, printed and posted
 * to someone who never paid for it.
 */
describe("payment gate", () => {
  it("lets an order be acknowledged before the money arrives", () => {
    expect(requiresPayment("new")).toBe(false);
    expect(requiresPayment(UNPAID_CEILING)).toBe(false);
  });

  it("requires payment for everything that spends something", () => {
    for (const status of [
      "design",
      "awaiting_approval",
      "approved",
      "in_production",
      "qc",
      "ready_for_dispatch",
      "dispatched",
      "delivered",
    ] as const) {
      expect(requiresPayment(status)).toBe(true);
    }
  });

  /** Cancelling an unpaid order is precisely what should happen to it. */
  it("never requires payment to cancel", () => {
    expect(requiresPayment("cancelled")).toBe(false);
  });

  /** revision_requested sits off the pipeline, so indexOf gives -1. The safe
      answer for a stage the rule does not recognise is "payment required". */
  it("defaults an off-pipeline stage to requiring payment", () => {
    expect(requiresPayment("revision_requested")).toBe(true);
  });

  it("blocks the exact move that produced TT004", () => {
    expect(transitionBlockedReason("dispatched", "delivered", false)).toMatch(/payment/i);
    expect(transitionBlockedReason("dispatched", "delivered", true)).toBeNull();
  });

  it("explains an illegal move differently from an unpaid one", () => {
    expect(transitionBlockedReason("new", "delivered", true)).toMatch(/cannot move/i);
    expect(transitionBlockedReason("content_received", "design", false)).toMatch(/payment/i);
  });

  it("narrows the offered moves to cancellation while unpaid", () => {
    expect(availableTransitions("content_received", false)).toEqual(["cancelled"]);
    expect(availableTransitions("content_received", true)).toEqual(["design", "cancelled"]);
  });

  it("still allows the first acknowledgement unpaid", () => {
    expect(availableTransitions("new", false)).toEqual(["content_received", "cancelled"]);
  });

  /** An unpaid order must never be able to reach a terminal success state. */
  it("leaves no unpaid route to delivered", () => {
    let reachable: OrderStatus[] = ["new"];
    const seen = new Set<OrderStatus>(reachable);
    while (reachable.length) {
      const next: OrderStatus[] = [];
      for (const from of reachable) {
        for (const to of availableTransitions(from, false)) {
          if (seen.has(to)) continue;
          seen.add(to);
          next.push(to);
        }
      }
      reachable = next;
    }
    expect(seen.has("delivered")).toBe(false);
    expect(seen.has("in_production")).toBe(false);
    expect(seen.has("cancelled")).toBe(true);
  });
});
