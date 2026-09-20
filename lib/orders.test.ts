import { describe, it, expect } from "vitest";
import {
  ORDER_STATUSES,
  FULFILMENT_PIPELINE,
  STOCK_PIPELINE,
  PIPELINE_BY_PATH,
  ORDER_STATUS_META,
  isOrderStatus,
  canTransition,
  allowedTransitions,
  nextStatus,
  isTerminal,
  customerFacingStatus,
  requiresPayment,
  transitionBlockedReason,
  bindingBlockedReason,
  availableTransitions,
  pathForProduct,
  stuckThresholdDays,
  isAwaitingFirstTap,
  UNPAID_CEILING,
  daysAtStage,
  isStuck,
  pipelineProgress,
  PRODUCT_KIND,
  DISPATCH_METHODS,
  DISPATCH_METHOD_META,
  isDispatchMethod,
  checkoutNextSteps,
  type OrderStatus,
  type FulfilmentPath,
} from "./orders";

const NOW = new Date("2026-08-30T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

/**
 * The path every pre-Sprint-8 order walked. Held as a constant so the tests that
 * existed before paths did read as "this behaviour is unchanged" rather than as
 * an arbitrary argument.
 */
const MTO: FulfilmentPath = "made_to_order";

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

  it("keeps every path's happy line inside the status list", () => {
    for (const pipeline of Object.values(PIPELINE_BY_PATH)) {
      for (const status of pipeline) expect(ORDER_STATUSES).toContain(status);
    }
  });
});

describe("transitions", () => {
  it("walks the happy path end to end", () => {
    for (let i = 0; i < FULFILMENT_PIPELINE.length - 1; i++) {
      const from = FULFILMENT_PIPELINE[i];
      const to = FULFILMENT_PIPELINE[i + 1];
      expect(canTransition(MTO, from, to)).toBe(true);
      expect(nextStatus(MTO, from)).toBe(to);
    }
  });

  it("refuses to skip stages", () => {
    expect(canTransition(MTO, "new", "in_production")).toBe(false);
    expect(canTransition(MTO, "design", "dispatched")).toBe(false);
    expect(canTransition(MTO, "approved", "delivered")).toBe(false);
  });

  it("refuses to run backwards along the pipeline", () => {
    expect(canTransition(MTO, "in_production", "design")).toBe(false);
    expect(canTransition(MTO, "delivered", "dispatched")).toBe(false);
  });

  /** QC failing sends work back to the bench; that is a loop, not a skip. */
  it("allows the two loops that real production needs", () => {
    expect(canTransition(MTO, "awaiting_approval", "revision_requested")).toBe(true);
    expect(canTransition(MTO, "revision_requested", "design")).toBe(true);
    expect(canTransition(MTO, "qc", "in_production")).toBe(true);
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
      expect(canTransition(MTO, status, "cancelled")).toBe(true);
    }
    expect(canTransition(MTO, "dispatched", "cancelled")).toBe(false);
    expect(canTransition(MTO, "delivered", "cancelled")).toBe(false);
  });

  it("treats delivered and cancelled as terminal", () => {
    expect(isTerminal(MTO, "delivered")).toBe(true);
    expect(isTerminal(MTO, "cancelled")).toBe(true);
    expect(allowedTransitions(MTO, "delivered")).toEqual([]);
    expect(isTerminal(MTO, "new")).toBe(false);
    expect(nextStatus(MTO, "delivered")).toBeNull();
  });

  it("has no transition leading to a status that does not exist", () => {
    for (const path of Object.keys(PIPELINE_BY_PATH) as FulfilmentPath[]) {
      for (const status of ORDER_STATUSES) {
        for (const target of allowedTransitions(path, status)) {
          expect(ORDER_STATUSES).toContain(target);
        }
      }
    }
  });

  it("never allows a status to transition to itself", () => {
    for (const path of Object.keys(PIPELINE_BY_PATH) as FulfilmentPath[]) {
      for (const status of ORDER_STATUSES) {
        expect(allowedTransitions(path, status)).not.toContain(status);
      }
    }
  });

  /** Every non-terminal stage must be able to reach an ending. */
  it("leaves no stage with nowhere to go", () => {
    for (const status of ORDER_STATUSES) {
      if (status === "delivered" || status === "cancelled") continue;
      expect(allowedTransitions(MTO, status).length).toBeGreaterThan(0);
    }
  });
});

/**
 * The stock path (D-026).
 *
 * A printed card is picked, packed and posted. There is nothing to design, no
 * artwork to collect, and no QC stage because the card was tested when its chip
 * was encoded and locked — weeks before anyone bought it.
 */
describe("the stock path", () => {
  it("is four stages and no workshop", () => {
    expect(STOCK_PIPELINE).toEqual(["new", "ready_for_dispatch", "dispatched", "delivered"]);
  });

  it("walks straight from paid to packed", () => {
    expect(canTransition("stock", "new", "ready_for_dispatch")).toBe(true);
    expect(nextStatus("stock", "new")).toBe("ready_for_dispatch");
  });

  /**
   * Unreachable rather than merely unused. A production stage a stock order can
   * never legally enter cannot be reached by a stale form post or by a future
   * code path that forgets which kind of order it is holding.
   */
  it("makes every production stage unreachable", () => {
    for (const stage of [
      "content_received",
      "design",
      "awaiting_approval",
      "approved",
      "in_production",
      "qc",
    ] as const) {
      expect(canTransition("stock", "new", stage)).toBe(false);
      expect(allowedTransitions("stock", stage)).toEqual([]);
    }
  });

  it("still cannot be cancelled once it has gone out", () => {
    expect(canTransition("stock", "ready_for_dispatch", "cancelled")).toBe(true);
    expect(canTransition("stock", "dispatched", "cancelled")).toBe(false);
  });

  /**
   * A stock order has no free stage: its first move spends a printed card off
   * the shelf, so there is nothing below the unpaid ceiling to reach.
   */
  it("has nothing an unpaid order may do but cancel", () => {
    expect(availableTransitions("stock", "new", false)).toEqual(["cancelled"]);
    expect(availableTransitions("stock", "new", true)).toEqual([
      "ready_for_dispatch",
      "cancelled",
    ]);
  });

  it("leaves no unpaid route to delivered", () => {
    let reachable: OrderStatus[] = ["new"];
    const seen = new Set<OrderStatus>(reachable);
    while (reachable.length) {
      const next: OrderStatus[] = [];
      for (const from of reachable) {
        for (const to of availableTransitions("stock", from, false)) {
          if (seen.has(to)) continue;
          seen.add(to);
          next.push(to);
        }
      }
      reachable = next;
    }
    expect(seen.has("delivered")).toBe(false);
    expect(seen.has("ready_for_dispatch")).toBe(false);
    expect(seen.has("cancelled")).toBe(true);
  });
});

describe("pathForProduct", () => {
  it("routes each product to its own pipeline", () => {
    expect(pathForProduct("smart_card")).toBe("stock");
    expect(pathForProduct("smart_card_premium")).toBe("custom");
    expect(pathForProduct("smart_stand")).toBe("made_to_order");
    expect(pathForProduct("smart_card_replacement")).toBe("stock");
  });

  /**
   * The conservative direction: an unrecognised product gets the longest
   * pipeline with the most checkpoints, not the one that ships in two clicks.
   */
  it("falls back to the longest pipeline for an unknown product", () => {
    expect(pathForProduct("mystery_box")).toBe("made_to_order");
    expect(pathForProduct(null)).toBe("made_to_order");
  });
});

/**
 * Nothing is packed that has not been picked.
 *
 * Enforced in the rules rather than only hidden in the UI, for the TT004 reason:
 * a rule that lives in a rendered button is not a rule. An order that reaches
 * dispatch with an unbound unit is a parcel posted with a card in it that points
 * at nobody.
 */
describe("the binding gate", () => {
  it("blocks packing until every card is scanned", () => {
    expect(bindingBlockedReason("ready_for_dispatch", { total: 2, bound: 0 })).toMatch(/scan/i);
    expect(bindingBlockedReason("ready_for_dispatch", { total: 2, bound: 1 })).toMatch(/1 of 2/);
    expect(bindingBlockedReason("ready_for_dispatch", { total: 2, bound: 2 })).toBeNull();
  });

  it("says something different for nothing scanned than for a partial order", () => {
    expect(bindingBlockedReason("ready_for_dispatch", { total: 1, bound: 0 })).toMatch(/the card/i);
    expect(bindingBlockedReason("ready_for_dispatch", { total: 3, bound: 0 })).toMatch(/all 3/i);
  });

  /** It gates the one move that commits plastic to a parcel, and no other. */
  it("does not gate anything but packing", () => {
    expect(bindingBlockedReason("cancelled", { total: 2, bound: 0 })).toBeNull();
    expect(bindingBlockedReason("design", { total: 2, bound: 0 })).toBeNull();
  });

  /** An order placed before units existed has none, and must still be movable. */
  it("ignores an order with no units recorded", () => {
    expect(bindingBlockedReason("ready_for_dispatch", { total: 0, bound: 0 })).toBeNull();
    expect(bindingBlockedReason("ready_for_dispatch", null)).toBeNull();
  });

  it("stops a paid stock order reaching dispatch unscanned", () => {
    expect(
      transitionBlockedReason("stock", "new", "ready_for_dispatch", true, { total: 1, bound: 0 }),
    ).toMatch(/scan/i);
    expect(
      availableTransitions("stock", "new", true, { total: 1, bound: 0 }),
    ).toEqual(["cancelled"]);
  });

  it("applies to every path, not only stock", () => {
    expect(
      transitionBlockedReason("custom", "qc", "ready_for_dispatch", true, { total: 2, bound: 1 }),
    ).toMatch(/scan/i);
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

  /**
   * "Ready to ship" is accurate for a workshop and slightly wrong for a
   * customer: their card is not being prepared, it is in a bag with their name
   * on it.
   */
  it("tells a stock customer their card is packed, not being prepared", () => {
    expect(customerFacingStatus("ready_for_dispatch", "paid", "stock").customerLabel).toBe("Packed");
    expect(customerFacingStatus("ready_for_dispatch", "paid", "made_to_order").customerLabel).toBe(
      "Ready to ship",
    );
  });

  it("keeps the shared stages saying the same thing on every path", () => {
    for (const path of ["stock", "custom", "made_to_order"] as FulfilmentPath[]) {
      expect(customerFacingStatus("dispatched", "paid", path).customerLabel).toBe("On its way");
      expect(customerFacingStatus("delivered", "paid", path).customerLabel).toBe("Delivered");
    }
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
    expect(isStuck(order(), MTO, 5, NOW)).toBe(true);
    expect(isStuck(order({ updated_at: daysAgo(2) }), MTO, 5, NOW)).toBe(false);
  });

  it("is exact at the threshold", () => {
    expect(isStuck(order({ updated_at: daysAgo(5) }), MTO, 5, NOW)).toBe(true);
    expect(isStuck(order({ updated_at: daysAgo(4) }), MTO, 5, NOW)).toBe(false);
  });

  /**
   * The point of the flag is "what needs us". An order waiting on the customer
   * to approve artwork, or in transit, is not our bottleneck — counting those
   * would bury the ones that genuinely are.
   */
  it("does not blame us for time spent waiting on the customer", () => {
    expect(isStuck(order({ status: "awaiting_approval" }), MTO, 5, NOW)).toBe(false);
    expect(isStuck(order({ status: "dispatched" }), MTO, 5, NOW)).toBe(false);
  });

  it("never flags a finished order", () => {
    expect(isStuck(order({ status: "delivered", updated_at: daysAgo(400) }), MTO, 5, NOW)).toBe(false);
    expect(isStuck(order({ status: "cancelled", updated_at: daysAgo(400) }), MTO, 5, NOW)).toBe(false);
  });

  /**
   * A stock order is two minutes of work, so two days of nothing is already an
   * embarrassment. A stand is built by hand and five days at a stage is
   * ordinary. One threshold would either cry wolf on every stand or stay silent
   * while a paid card sat in a drawer for a week.
   */
  it("loses patience with a stock order sooner", () => {
    expect(stuckThresholdDays("stock")).toBe(2);
    expect(stuckThresholdDays("custom")).toBe(5);
    expect(stuckThresholdDays("made_to_order")).toBe(5);

    const paidUnpacked = order({ status: "new", updated_at: daysAgo(3) });
    expect(isStuck(paidUnpacked, "stock", stuckThresholdDays("stock"), NOW)).toBe(true);
    expect(isStuck(paidUnpacked, "made_to_order", stuckThresholdDays("made_to_order"), NOW)).toBe(
      false,
    );
  });
});

/**
 * Dispatched and never tapped.
 *
 * Deliberately not "stuck": the parcel is with a rider and the next move belongs
 * to the customer. It still needs a list, because a card nobody ever taps is
 * either lost in transit or unopened on a desk, and both are worth a call before
 * the customer decides we sold them nothing.
 */
describe("isAwaitingFirstTap", () => {
  const dispatched = (days: number) => ({
    status: "dispatched" as OrderStatus,
    updated_at: daysAgo(days),
    created_at: daysAgo(days + 5),
  });

  it("waits a week before asking anyone to chase it", () => {
    expect(isAwaitingFirstTap(dispatched(8), null, NOW)).toBe(true);
    expect(isAwaitingFirstTap(dispatched(3), null, NOW)).toBe(false);
  });

  it("goes quiet the moment the card is tapped", () => {
    expect(isAwaitingFirstTap(dispatched(30), daysAgo(1), NOW)).toBe(false);
  });

  it("only applies in transit", () => {
    expect(isAwaitingFirstTap({ ...dispatched(30), status: "delivered" }, null, NOW)).toBe(false);
    expect(isAwaitingFirstTap({ ...dispatched(30), status: "new" }, null, NOW)).toBe(false);
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

  /**
   * A stock order is a quarter done when it is paid for, not a tenth. Measuring
   * it against the full pipeline would show a customer a bar that barely moves
   * and then jumps, which reads as nothing happening.
   */
  it("measures a stock order against its own four stages", () => {
    expect(pipelineProgress("new", "stock")).toBe(0.25);
    expect(pipelineProgress("delivered", "stock")).toBe(1);
    expect(pipelineProgress("new", "stock")).toBeGreaterThan(pipelineProgress("new", "made_to_order"));
  });
});

describe("PRODUCT_KIND", () => {
  it("maps every seeded product to a device kind", () => {
    expect(PRODUCT_KIND.smart_card).toBe("card");
    expect(PRODUCT_KIND.smart_stand).toBe("stand");
  });

  /** A Premium card is still a card: it renews like one and counts as one (D-018). */
  it("bills a premium card as a card", () => {
    expect(PRODUCT_KIND.smart_card_premium).toBe("card");
    expect(PRODUCT_KIND.smart_card_replacement).toBe("card");
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
    expect(requiresPayment(MTO, "new")).toBe(false);
    expect(requiresPayment(MTO, UNPAID_CEILING)).toBe(false);
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
      expect(requiresPayment(MTO, status)).toBe(true);
    }
  });

  /** Cancelling an unpaid order is precisely what should happen to it. */
  it("never requires payment to cancel", () => {
    expect(requiresPayment(MTO, "cancelled")).toBe(false);
    expect(requiresPayment("stock", "cancelled")).toBe(false);
  });

  /** revision_requested sits off the pipeline, so indexOf gives -1. The safe
      answer for a stage the rule does not recognise is "payment required". */
  it("defaults an off-pipeline stage to requiring payment", () => {
    expect(requiresPayment(MTO, "revision_requested")).toBe(true);
  });

  it("blocks the exact move that produced TT004", () => {
    expect(transitionBlockedReason(MTO, "dispatched", "delivered", false)).toMatch(/payment/i);
    expect(transitionBlockedReason(MTO, "dispatched", "delivered", true)).toBeNull();
  });

  it("explains an illegal move differently from an unpaid one", () => {
    expect(transitionBlockedReason(MTO, "new", "delivered", true)).toMatch(/cannot move/i);
    expect(transitionBlockedReason(MTO, "content_received", "design", false)).toMatch(/payment/i);
  });

  it("narrows the offered moves to cancellation while unpaid", () => {
    expect(availableTransitions(MTO, "content_received", false)).toEqual(["cancelled"]);
    expect(availableTransitions(MTO, "content_received", true)).toEqual(["design", "cancelled"]);
  });

  it("still allows the first acknowledgement unpaid", () => {
    expect(availableTransitions(MTO, "new", false)).toEqual(["content_received", "cancelled"]);
  });

  /** An unpaid order must never be able to reach a terminal success state. */
  it("leaves no unpaid route to delivered", () => {
    let reachable: OrderStatus[] = ["new"];
    const seen = new Set<OrderStatus>(reachable);
    while (reachable.length) {
      const next: OrderStatus[] = [];
      for (const from of reachable) {
        for (const to of availableTransitions(MTO, from, false)) {
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


/**
 * The three ways anything leaves the building.
 *
 * `record_dispatch` (0023) refuses any other value, so this list drifting from
 * that one means a staff member picks a method from a dropdown and the save
 * fails with a database error.
 */
describe("dispatch methods", () => {
  it("accepts exactly the three the database allows", () => {
    expect(DISPATCH_METHODS).toEqual(["rider", "courier", "shuttle"]);
    for (const m of DISPATCH_METHODS) expect(isDispatchMethod(m)).toBe(true);
  });

  it("refuses anything else, including the empty and the absent", () => {
    expect(isDispatchMethod("post")).toBe(false);
    expect(isDispatchMethod("")).toBe(false);
    expect(isDispatchMethod(null)).toBe(false);
    expect(isDispatchMethod(undefined)).toBe(false);
  });

  /**
   * The reference field renames itself per method. A generic "Reference" label
   * is how a rider's phone number ends up in a waybill field, and then the
   * customer's email carries the wrong kind of fact under the right heading.
   */
  it("names the reference after what that method actually produces", () => {
    expect(DISPATCH_METHOD_META.rider.referenceLabel).toMatch(/rider/i);
    expect(DISPATCH_METHOD_META.courier.referenceLabel).toMatch(/waybill/i);
    expect(DISPATCH_METHOD_META.shuttle.referenceLabel).toMatch(/shuttle|parcel/i);
  });

  it("has a customer-facing phrase for every method", () => {
    for (const m of DISPATCH_METHODS) {
      expect(DISPATCH_METHOD_META[m].customerNoun.length).toBeGreaterThan(0);
      expect(DISPATCH_METHOD_META[m].label.length).toBeGreaterThan(0);
    }
  });
});

/**
 * What the customer is promised after paying.
 *
 * The single old version told everyone "we will contact you about artwork",
 * which is now false for a Standard card that is already printed and on a shelf
 * (D-025). Wrong more often than right is worse than absent: it sets up a phone
 * call that never comes.
 */
describe("checkoutNextSteps", () => {
  const PATHS: FulfilmentPath[] = ["stock", "custom", "made_to_order"];

  it("gives every path a set of steps", () => {
    for (const path of PATHS) {
      const steps = checkoutNextSteps(path);
      expect(steps.length).toBeGreaterThan(2);
      for (const step of steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.body.length).toBeGreaterThan(0);
      }
    }
  });

  /** The whole reason this is path-dependent. */
  it("never promises a stock buyer a design conversation", () => {
    const text = checkoutNextSteps("stock")
      .map((s) => `${s.title} ${s.body}`)
      .join(" ")
      .toLowerCase();
    expect(text).not.toContain("artwork");
    expect(text).not.toContain("approve the design");
    expect(text).toContain("already printed");
  });

  it("still promises a stand buyer one, because that one is true", () => {
    const text = checkoutNextSteps("made_to_order")
      .map((s) => `${s.title} ${s.body}`)
      .join(" ")
      .toLowerCase();
    expect(text).toContain("artwork");
  });

  it("tells a premium buyer they approve a proof", () => {
    const text = checkoutNextSteps("custom")
      .map((s) => `${s.title} ${s.body}`)
      .join(" ")
      .toLowerCase();
    expect(text).toContain("proof");
  });

  /** Every path starts by telling them the thing they can do RIGHT NOW (D-022). */
  it("leads with publishing, which is the only thing they can do today", () => {
    for (const path of PATHS) {
      expect(checkoutNextSteps(path)[0].icon).toBe("publish");
    }
  });

  /** Customer copy. The house rule, and the marketing test enforces it elsewhere. */
  it("uses no em dashes anywhere in the copy", () => {
    for (const path of PATHS) {
      for (const step of checkoutNextSteps(path)) {
        expect(step.title).not.toContain("—");
        expect(step.body).not.toContain("—");
      }
    }
  });

  it("falls back to the made-to-order wording for an unknown path", () => {
    const unknown = "nonsense" as FulfilmentPath;
    expect(checkoutNextSteps(unknown)).toEqual(checkoutNextSteps("made_to_order"));
  });
});
