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

import type { DeviceKind } from "./pricing";

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
 * Legal moves.
 *
 * Written out rather than derived from the pipeline order, because the
 * interesting transitions are the ones that leave it: a revision can be asked
 * for while a design is being approved, and an order can be cancelled at any
 * point before it ships but never after it has been delivered.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
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

export function isOrderStatus(value: string | null | undefined): value is OrderStatus {
  return ORDER_STATUSES.includes((value ?? "") as OrderStatus);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** The next step along the happy path, if there is one. */
export function nextStatus(from: OrderStatus): OrderStatus | null {
  const index = FULFILMENT_PIPELINE.indexOf(from);
  if (index < 0 || index === FULFILMENT_PIPELINE.length - 1) return null;
  const next = FULFILMENT_PIPELINE[index + 1];
  return canTransition(from, next) ? next : null;
}

export function isTerminal(status: OrderStatus): boolean {
  return allowedTransitions(status).length === 0;
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

export function customerFacingStatus(
  status: OrderStatus,
  payment: OrderPaymentStatus | null | undefined,
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

  return ORDER_STATUS_META[status];
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
export function isStuck(
  order: Pick<Order, "status" | "updated_at" | "created_at">,
  thresholdDays = 5,
  now: Date = new Date(),
): boolean {
  if (isTerminal(order.status)) return false;
  if (WAITING_ON_CUSTOMER.has(order.status)) return false;
  return daysAtStage(order.updated_at, order.created_at, now) >= thresholdDays;
}

export const PRODUCT_KIND: Record<string, DeviceKind> = {
  smart_card: "card",
  smart_stand: "stand",
};

/** How far along the happy path an order is, for a progress indicator. */
export function pipelineProgress(status: OrderStatus): number {
  if (status === "cancelled") return 0;
  const index = FULFILMENT_PIPELINE.indexOf(
    status === "revision_requested" ? "design" : status,
  );
  if (index < 0) return 0;
  return (index + 1) / FULFILMENT_PIPELINE.length;
}
