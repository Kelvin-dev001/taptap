/**
 * Order fulfilment vocabulary and its state machine (D-019).
 *
 * Pure on purpose. Which moves are legal, what a stage means to a customer, and
 * when an order is stuck are all decidable without a database — the same split
 * that keeps `lib/identity.ts` reviewable in one file.
 *
 * The DATABASE guarantees that every transition is recorded (a trigger writes
 * `order_events`); THIS file decides whether a transition is allowed. Splitting
 * it that way means the audit log cannot be bypassed by a future code path, and
 * the rules cannot drift out of sync with a second copy written in SQL.
 */

import { PRODUCTS, isProductCode, type DeviceKind, type FulfilmentPath } from "./pricing";

export type { FulfilmentPath };

export const ORDER_STATUSES = [
  "new",
  "content_received",
  "design",
  "awaiting_approval",
  "approved",
  "in_production",
  "qc",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
  "revision_requested",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Order = {
  id: string;
  number: string;
  account_id: string;
  product_code: string;
  quantity: number;
  amount_kes: number;
  status: OrderStatus;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type OrderEvent = {
  id: number;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  at: string;
};

/**
 * The happy path, in order. `revision_requested` and `cancelled` sit outside it
 * because they are departures from the line rather than points on it.
 *
 * This is the full pipeline, which is what `custom` and `made_to_order` both
 * walk. `stock` has its own, four stages long — see PIPELINE_BY_PATH.
 */
export const FULFILMENT_PIPELINE: OrderStatus[] = [
  "new",
  "content_received",
  "design",
  "awaiting_approval",
  "approved",
  "in_production",
  "qc",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
];

/**
 * A stock order is picked, packed and posted (D-026).
 *
 * There is no content stage because nothing is collected, no design stage
 * because nothing is drawn, and no QC stage because the card was tested when its
 * chip was encoded and locked — weeks before anyone bought it. Carrying the full
 * pipeline here and expecting staff to click through six stages that mean
 * nothing is how a board stops being believed.
 */
export const STOCK_PIPELINE: OrderStatus[] = [
  "new",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
];

export const PIPELINE_BY_PATH: Record<FulfilmentPath, OrderStatus[]> = {
  stock: STOCK_PIPELINE,
  custom: FULFILMENT_PIPELINE,
  made_to_order: FULFILMENT_PIPELINE,
};

/**
 * Legal moves.
 *
 * Written out rather than derived from the pipeline order, because the
 * interesting transitions are the ones that leave it: a revision can be asked
 * for while a design is being approved, and an order can be cancelled at any
 * point before it ships but never after it has been delivered.
 */
const FULL_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["content_received", "cancelled"],
  content_received: ["design", "cancelled"],
  design: ["awaiting_approval", "cancelled"],
  awaiting_approval: ["approved", "revision_requested", "cancelled"],
  revision_requested: ["design", "cancelled"],
  approved: ["in_production", "cancelled"],
  in_production: ["qc", "cancelled"],
  qc: ["ready_for_dispatch", "in_production", "cancelled"],
  ready_for_dispatch: ["dispatched", "cancelled"],
  dispatched: ["delivered"],
  // Terminal. A delivered card is in someone's hand; unwinding that is a
  // conversation and a refund, not a status change.
  delivered: [],
  cancelled: [],
};

/**
 * Stock. Every production stage is unreachable rather than merely unused — a
 * stage a stock order can never legally enter cannot be reached by a stale form
 * post or a future code path that forgets which kind of order it is holding.
 */
const STOCK_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["ready_for_dispatch", "cancelled"],
  ready_for_dispatch: ["dispatched", "cancelled"],
  dispatched: ["delivered"],
  delivered: [],
  cancelled: [],
  content_received: [],
  design: [],
  awaiting_approval: [],
  revision_requested: [],
  approved: [],
  in_production: [],
  qc: [],
};

const TRANSITIONS_BY_PATH: Record<FulfilmentPath, Record<OrderStatus, OrderStatus[]>> = {
  stock: STOCK_TRANSITIONS,
  custom: FULL_TRANSITIONS,
  made_to_order: FULL_TRANSITIONS,
};

/**
 * Which pipeline a product walks.
 *
 * Falls back to `made_to_order` for a code this build does not recognise, which
 * is the conservative direction: an unknown product gets the longest pipeline
 * with the most checkpoints rather than the one that ships in two clicks.
 */
export function pathForProduct(productCode: string | null | undefined): FulfilmentPath {
  return isProductCode(productCode) ? PRODUCTS[productCode].path : "made_to_order";
}

export function isOrderStatus(value: string | null | undefined): value is OrderStatus {
  return ORDER_STATUSES.includes((value ?? "") as OrderStatus);
}

export function canTransition(
  path: FulfilmentPath,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return (TRANSITIONS_BY_PATH[path][from] ?? []).includes(to);
}

export function allowedTransitions(path: FulfilmentPath, from: OrderStatus): OrderStatus[] {
  return TRANSITIONS_BY_PATH[path][from] ?? [];
}

/** The next step along this path's happy line, if there is one. */
export function nextStatus(path: FulfilmentPath, from: OrderStatus): OrderStatus | null {
  const pipeline = PIPELINE_BY_PATH[path];
  const index = pipeline.indexOf(from);
  if (index < 0 || index === pipeline.length - 1) return null;
  const next = pipeline[index + 1];
  return canTransition(path, from, next) ? next : null;
}

export function isTerminal(path: FulfilmentPath, status: OrderStatus): boolean {
  return allowedTransitions(path, status).length === 0;
}

/**
 * The furthest an unpaid order may travel.
 *
 * Acknowledging that an order exists and that the customer has sent their
 * content costs nothing. Everything past that point spends something real —
 * design time, a blank card, printing, postage — so it waits for the money.
 *
 * Found the hard way: TT004 reached `delivered` with a failed payment, because
 * the board displayed a "Not paid" badge and displaying is not enforcing. In a
 * real workshop that is a card encoded and posted to someone who never paid.
 */
export const UNPAID_CEILING: OrderStatus = "content_received";

export function requiresPayment(path: FulfilmentPath, to: OrderStatus): boolean {
  // Cancelling an unpaid order is exactly what should happen to it.
  if (to === "cancelled") return false;

  // A stock order has no free stage. Its very first move spends a printed card
  // off the shelf, so there is nothing below the ceiling to reach.
  if (path === "stock") return to !== "new";

  const index = FULFILMENT_PIPELINE.indexOf(to);
  // Off-pipeline stages (revision_requested) are only reachable from deep in
  // the paid section anyway, but default to requiring payment rather than
  // assuming — the safe answer for a stage this does not recognise is "no".
  if (index < 0) return true;
  return index > FULFILMENT_PIPELINE.indexOf(UNPAID_CEILING);
}

/**
 * How many of an order's physical units have a card against them.
 *
 * `bound` counts units where a real card has been scanned in; `total` is the
 * order's quantity. A stand is bound at provisioning, because its token IS the
 * unit — there is no shelf to take one from.
 */
export type UnitBinding = { total: number; bound: number };

/**
 * Every path refuses to pack what it has not picked.
 *
 * Enforced here rather than only hidden in the UI, because TT004 is exactly what
 * happens when a rule lives in a rendered button: an order reached `delivered`
 * with a failed payment because the board displayed a badge, and displaying is
 * not enforcing. An order that reaches dispatch with an unbound unit is a parcel
 * posted with a card in it that points at nobody.
 */
export function bindingBlockedReason(
  to: OrderStatus,
  units: UnitBinding | null | undefined,
): string | null {
  if (to !== "ready_for_dispatch") return null;
  if (!units || units.total <= 0) return null;
  if (units.bound >= units.total) return null;

  const missing = units.total - units.bound;
  return missing === units.total
    ? `No cards scanned yet. Scan ${units.total === 1 ? "the card" : `all ${units.total} cards`} before packing.`
    : `${missing} of ${units.total} cards still to scan.`;
}

/**
 * Why a move is not allowed, or null if it is.
 *
 * One function so the console and the server action cannot disagree about what
 * is permitted — the UI uses it to decide what to offer, the action re-checks it
 * against the order's current state, and there is no second copy of the rule to
 * drift.
 */
export function transitionBlockedReason(
  path: FulfilmentPath,
  from: OrderStatus,
  to: OrderStatus,
  isPaid: boolean,
  units?: UnitBinding | null,
): string | null {
  if (!canTransition(path, from, to)) {
    return `${ORDER_STATUS_META[from].label} cannot move to ${ORDER_STATUS_META[to].label}.`;
  }
  if (!isPaid && requiresPayment(path, to)) {
    return `${ORDER_STATUS_META[to].label} needs the payment to have cleared. Cancel it instead if it is not going to.`;
  }
  return bindingBlockedReason(to, units);
}

/** The moves that may actually be made right now, payment and cards included. */
export function availableTransitions(
  path: FulfilmentPath,
  from: OrderStatus,
  isPaid: boolean,
  units?: UnitBinding | null,
): OrderStatus[] {
  return allowedTransitions(path, from).filter(
    (to) => !transitionBlockedReason(path, from, to, isPaid, units),
  );
}

/**
 * Fulfilment and payment are separate state machines, joined only in the views.
 *
 * An order's `status` says where it is in production; whether it has been paid
 * for is a fact about its payment row. Collapsing the two into one column would
 * mean inventing statuses like "paid_but_not_started" and then keeping them in
 * step with Daraja, which is how a flat status ends up lying.
 */
export type OrderPaymentStatus = "pending" | "paid" | "failed";

/**
 * What a stock order's stages are called to the person who bought it.
 *
 * "Ready to ship" is accurate for a workshop and slightly wrong for a customer:
 * their card is not being prepared, it is in a bag with their name on it. Only
 * the stages whose meaning actually changes are overridden.
 */
const STOCK_CUSTOMER_LABELS: Partial<Record<OrderStatus, Pick<StatusMeta, "customerLabel" | "description">>> = {
  new: { customerLabel: "Paid", description: "Paid. We are picking your card" },
  ready_for_dispatch: { customerLabel: "Packed", description: "Packed and waiting for the rider" },
};

export function customerFacingStatus(
  status: OrderStatus,
  payment: OrderPaymentStatus | null | undefined,
  path: FulfilmentPath = "made_to_order",
): StatusMeta {
  if (status === "cancelled") return ORDER_STATUS_META.cancelled;

  // Payment outranks fulfilment while it is unresolved: an order that has not
  // been paid for has not really started, whatever its stage says.
  if (payment === "pending") {
    return {
      label: "Awaiting payment",
      customerLabel: "Awaiting payment",
      description: "Waiting for the M-Pesa PIN prompt to be completed",
      tone: "warning",
    };
  }
  if (payment === "failed" || !payment) {
    return {
      label: "Payment failed",
      customerLabel: "Payment failed",
      description: "M-Pesa reported the payment did not go through",
      tone: "danger",
    };
  }

  const base = ORDER_STATUS_META[status];
  const override = path === "stock" ? STOCK_CUSTOMER_LABELS[status] : undefined;
  return override ? { ...base, ...override } : base;
}

export type StatusMeta = {
  label: string;
  /** What the customer is told. Deliberately plainer than the internal label. */
  customerLabel: string;
  description: string;
  tone: "info" | "warning" | "success" | "neutral" | "danger";
};

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  new: {
    label: "New",
    customerLabel: "Paid",
    description: "Paid. We have not started on it yet",
    tone: "info",
  },
  content_received: {
    label: "Content received",
    customerLabel: "In progress",
    description: "We have what we need to start",
    tone: "info",
  },
  design: {
    label: "Design",
    customerLabel: "Being designed",
    description: "Artwork is being prepared",
    tone: "info",
  },
  awaiting_approval: {
    label: "Awaiting approval",
    customerLabel: "Ready for your approval",
    description: "Waiting on the customer to approve the design",
    tone: "warning",
  },
  revision_requested: {
    label: "Revision requested",
    customerLabel: "Changes being made",
    description: "Back to design with changes",
    tone: "warning",
  },
  approved: {
    label: "Approved",
    customerLabel: "Approved",
    description: "Design signed off, queued for production",
    tone: "info",
  },
  in_production: {
    label: "In production",
    customerLabel: "Being made",
    description: "Being printed and encoded",
    tone: "info",
  },
  qc: {
    label: "QC",
    customerLabel: "Being made",
    description: "Being checked before dispatch",
    tone: "info",
  },
  ready_for_dispatch: {
    label: "Ready for dispatch",
    customerLabel: "Ready to ship",
    description: "Packed and waiting to go out",
    tone: "info",
  },
  dispatched: {
    label: "Dispatched",
    customerLabel: "On its way",
    description: "On its way to the customer",
    tone: "success",
  },
  delivered: {
    label: "Delivered",
    customerLabel: "Delivered",
    description: "Received by the customer",
    tone: "success",
  },
  cancelled: {
    label: "Cancelled",
    customerLabel: "Cancelled",
    description: "Cancelled. Any identity it created has been switched off",
    tone: "danger",
  },
};

/**
 * Days an order has sat at its current stage.
 *
 * Ops needs this to answer "what is stuck", which is a different and more useful
 * question than "how old is this order".
 */
export function daysAtStage(
  updatedAt: string | null | undefined,
  createdAt: string,
  now: Date = new Date(),
): number {
  const since = new Date(updatedAt ?? createdAt).getTime();
  if (!Number.isFinite(since)) return 0;
  return Math.max(0, Math.floor((now.getTime() - since) / 86_400_000));
}

/** Stages where sitting still is normal because we are waiting on someone else. */
const WAITING_ON_CUSTOMER: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "awaiting_approval",
  "dispatched",
]);

/**
 * Is this order stuck?
 *
 * Terminal stages never are, and neither does an order waiting on the customer
 * count against us in the same way — flagging those as our problem would bury
 * the ones that genuinely are.
 */
/**
 * How long a path may sit still before it is our problem.
 *
 * A stock order is two minutes of work — scan, pack, hand to the rider — so two
 * days of nothing is already an embarrassment. A stand is built by hand and five
 * days at a stage is ordinary. One threshold for both would either cry wolf on
 * every stand or stay silent while a paid card sat in a drawer for a week.
 */
export function stuckThresholdDays(path: FulfilmentPath): number {
  return path === "stock" ? 2 : 5;
}

export function isStuck(
  order: Pick<Order, "status" | "updated_at" | "created_at">,
  path: FulfilmentPath = "made_to_order",
  thresholdDays: number = stuckThresholdDays(path),
  now: Date = new Date(),
): boolean {
  if (isTerminal(path, order.status)) return false;
  if (WAITING_ON_CUSTOMER.has(order.status)) return false;
  return daysAtStage(order.updated_at, order.created_at, now) >= thresholdDays;
}

/**
 * Dispatched, and nobody has tapped it.
 *
 * Deliberately NOT "stuck": the parcel is with a rider or a courier and the next
 * move belongs to the customer. It still needs a list, because a card that never
 * gets tapped is either lost in transit or sitting unopened on a desk, and both
 * are worth a phone call before the customer decides we sold them nothing.
 */
export const AWAITING_FIRST_TAP_DAYS = 7;

export function isAwaitingFirstTap(
  order: Pick<Order, "status" | "updated_at" | "created_at">,
  firstTapAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (order.status !== "dispatched") return false;
  if (firstTapAt) return false;
  return daysAtStage(order.updated_at, order.created_at, now) >= AWAITING_FIRST_TAP_DAYS;
}

/**
 * Billing kind by product code (D-018): a Premium card is still a card.
 *
 * Derived from PRODUCTS so a new SKU cannot be added in one place and forgotten
 * in the other. Unknown codes fall back to `card`, which is what every SKU but
 * the stand is and what an unrecognised card-shaped product almost certainly is.
 */
export const PRODUCT_KIND: Record<string, DeviceKind> = Object.fromEntries(
  Object.values(PRODUCTS).map((p) => [p.code, p.kind]),
);

/** How far along its own path an order is, for a progress indicator. */
export function pipelineProgress(
  status: OrderStatus,
  path: FulfilmentPath = "made_to_order",
): number {
  if (status === "cancelled") return 0;
  const pipeline = PIPELINE_BY_PATH[path];
  const index = pipeline.indexOf(status === "revision_requested" ? "design" : status);
  if (index < 0) return 0;
  return (index + 1) / pipeline.length;
}

/**
 * How a parcel actually left the building.
 *
 * "Dispatched" on its own cannot answer the only question a customer asks after
 * it, which is "where is it". These three are the whole of how anything leaves
 * here today: a rider on a bike in town, a courier upcountry, or a parcel under
 * a shuttle bus. Kept in step with the `p_method` values `record_dispatch`
 * (0023) refuses anything outside of — the database is what enforces it, this is
 * what the form offers and what the customer is shown.
 */
export const DISPATCH_METHODS = ["rider", "courier", "shuttle"] as const;

export type DispatchMethod = (typeof DISPATCH_METHODS)[number];

export function isDispatchMethod(value: string | null | undefined): value is DispatchMethod {
  return DISPATCH_METHODS.includes((value ?? "") as DispatchMethod);
}

export const DISPATCH_METHOD_META: Record<
  DispatchMethod,
  { label: string; referenceLabel: string; referenceHint: string; customerNoun: string }
> = {
  rider: {
    label: "Rider",
    referenceLabel: "Rider name and phone",
    referenceHint: "So the customer can call the person holding their parcel.",
    customerNoun: "with a rider",
  },
  courier: {
    label: "Courier",
    referenceLabel: "Waybill number",
    referenceHint: "The tracking number on the courier's slip.",
    customerNoun: "with a courier",
  },
  shuttle: {
    label: "Shuttle",
    referenceLabel: "Shuttle and parcel reference",
    referenceHint: "Which sacco, and the number on the parcel ticket.",
    customerNoun: "on a shuttle",
  },
};

/**
 * What the customer is told will happen next, by path.
 *
 * Per path because the paths genuinely differ, and the old single version
 * promised every customer that "we will contact you about artwork" — true for a
 * stand, and now a lie to somebody buying a Standard card that is already
 * printed and sitting on a shelf. Wrong more often than right is worse than
 * absent: it sets up a phone call that never comes.
 *
 * Here rather than in the page because it is the same rule as the customer
 * labels above and is tested the same way. No em dashes: this is customer copy.
 */
export type NextStep = { title: string; body: string; icon: "publish" | "design" | "pack" | "deliver" | "tap" };

const NEXT_STEPS: Record<FulfilmentPath, NextStep[]> = {
  stock: [
    {
      icon: "publish",
      title: "Publish your profile",
      body: "Your identity is active, so your Tap Profile can go live now. You can keep editing it afterwards, and changes go out when you publish again.",
    },
    {
      icon: "pack",
      title: "We pack your card",
      body: "Your card is already printed and encoded. We pair it with your profile and pack it, usually the same day.",
    },
    {
      icon: "deliver",
      title: "We send it to you",
      body: "You get the rider's number or a tracking reference when it leaves us. Follow it from your orders at any point.",
    },
    {
      icon: "tap",
      title: "Tap it to go live",
      body: "Android: tap the back of your phone. iPhone: tap near the top. No NFC? Scan the QR on the back.",
    },
  ],
  custom: [
    {
      icon: "publish",
      title: "Publish your profile",
      body: "Your identity is active, so your Tap Profile can go live now. The card opens whichever profile you choose for it.",
    },
    {
      icon: "design",
      title: "You approve the front",
      body: "We lay out your name, title and logo on the front of the card and send you a proof. Nothing is printed until you approve it.",
    },
    {
      icon: "pack",
      title: "We print and check it",
      body: "We print the front onto your card, test the chip and pack it.",
    },
    {
      icon: "deliver",
      title: "We send it to you",
      body: "You get the rider's number or a tracking reference when it leaves us.",
    },
  ],
  made_to_order: [
    {
      icon: "publish",
      title: "Publish your profile",
      body: "Your identity is active, so your Tap Profile can go live now. You can keep editing it afterwards, and changes go out when you publish again.",
    },
    {
      icon: "design",
      title: "We design it with you",
      body: "We will contact you about artwork and what you want printed. Nothing is produced until you approve the design.",
    },
    {
      icon: "pack",
      title: "We build and test it",
      body: "Your stand is produced, the chip is encoded and locked, and we check it works before it is packed.",
    },
    {
      icon: "deliver",
      title: "We send it to you",
      body: "You get the rider's number or a tracking reference when it leaves us.",
    },
  ],
};

export function checkoutNextSteps(path: FulfilmentPath = "made_to_order"): NextStep[] {
  return NEXT_STEPS[path] ?? NEXT_STEPS.made_to_order;
}
