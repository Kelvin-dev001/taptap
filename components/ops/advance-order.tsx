"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Alert } from "@/components/ui";
import {
  allowedTransitions,
  availableTransitions,
  ORDER_STATUS_META,
  type OrderStatus,
} from "@/lib/orders";
import { advanceOrderAction, type OpsResult } from "@/app/admin/order-actions";

const initial: OpsResult = {};

function MoveButton({ label, tone }: { label: string; tone: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={tone === "primary" ? "primary" : tone === "danger" ? "danger" : "secondary"}
      loading={pending}
      loadingText="Moving…"
    >
      {label}
    </Button>
  );
}

/**
 * Moving an order between stages.
 *
 * A row of buttons rather than drag-and-drop, and that is the accessible choice
 * rather than the lazy one. Transitions are CONSTRAINED — most drops onto a
 * Kanban column would have to be refused — and an interaction whose result is
 * usually "no" is a bad interaction. Rendering only the legal moves makes an
 * illegal one unreachable instead of rejected, and it works identically with a
 * keyboard, a screen reader and a mouse (§24).
 *
 * What is offered comes from the same `availableTransitions` the server re-checks
 * through `transitionBlockedReason`, so the two can never disagree — and that
 * includes the payment gate: an unpaid order is offered nothing but
 * cancellation past `content_received`, because hiding a button is presentation
 * and the server is what actually refuses.
 */
export function AdvanceOrder({
  orderId,
  status,
  isPaid,
  compact,
}: {
  orderId: string;
  status: OrderStatus;
  /** Whether a payment for this order has actually cleared. */
  isPaid: boolean;
  /** Board cards show only the forward move; the detail page shows everything. */
  compact?: boolean;
}) {
  const [state, action] = useActionState(advanceOrderAction, initial);

  const moves = availableTransitions(status, isPaid);
  // Offered nothing but cancellation while the money is outstanding — spending
  // design time or a blank card on an unpaid order is the thing being prevented.
  const withheldForPayment =
    !isPaid && allowedTransitions(status).length > moves.length;
  if (moves.length === 0) {
    return compact ? null : (
      <p className="text-caption text-muted">
        {ORDER_STATUS_META[status].description}. Nothing further to do here.
      </p>
    );
  }

  const forward = moves.filter((m) => m !== "cancelled");
  const shown = compact ? forward.slice(0, 1) : moves;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {shown.map((to) => (
          <form key={to} action={action}>
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="to" value={to} />
            <MoveButton
              label={
                to === "cancelled"
                  ? "Cancel order"
                  : compact
                    ? `→ ${ORDER_STATUS_META[to].label}`
                    : ORDER_STATUS_META[to].label
              }
              tone={
                to === "cancelled" ? "danger" : to === forward[0] ? "primary" : "secondary"
              }
            />
          </form>
        ))}
      </div>

      {withheldForPayment && !compact && (
        <p className="text-caption text-muted">
          Production stages open up once the payment clears. Cancel it if it is not going to.
        </p>
      )}

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
    </div>
  );
}
