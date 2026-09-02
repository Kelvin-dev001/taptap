"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Smartphone, TriangleAlert, Clock } from "lucide-react";
import { Card, Button, Alert, Spinner, Input, Field } from "@/components/ui";
import { formatKes } from "@/lib/pricing";
import {
  resolvePaymentState,
  secondsRemaining,
  shouldOfferManual,
  POLL_INTERVAL_MS,
  WAIT_SECONDS,
  PHASE_COPY,
  type CheckoutPhase,
} from "@/lib/checkout";
import {
  checkPaymentStatusAction,
  resendPromptAction,
  requestManualPaymentAction,
} from "@/app/dashboard/checkout/actions";

type Props = {
  /** Daraja CheckoutRequestID of the prompt currently outstanding. */
  reference: string;
  amountKes: number;
  /** Present for hardware orders; absent for a renewal, which has no order. */
  orderId?: string | null;
  orderNumber?: string | null;
  phone?: string | null;
  /** Where to go once the money is confirmed. */
  successHref: string;
  /** Paybill details for the manual fallback. Absent hides the fallback. */
  paybill?: string | null;
  paybillHint?: string | null;
};

/**
 * The waiting state, which used to not exist.
 *
 * Before Sprint 7 the checkout said "check your phone" and stopped. Whether the
 * money arrived was answered by refreshing Billing later, and a callback lost on
 * the network meant a paid customer with nothing to show for it.
 *
 * Three things fix that, and all three matter on a Kenyan connection: a
 * countdown so the wait has a visible end, a poll that resolves the screen
 * itself, and a way out that is not "start again". The poll asks our own
 * `payments` row first and only troubles Daraja while we genuinely do not know.
 */
export function PaymentStatus(props: Props) {
  const router = useRouter();

  const [reference, setReference] = React.useState(props.reference);
  const [startedAt, setStartedAt] = React.useState(() => Date.now());
  const [elapsed, setElapsed] = React.useState(0);
  const [attempts, setAttempts] = React.useState(1);
  const [serverStatus, setServerStatus] = React.useState<"pending" | "paid" | "failed">(
    "pending",
  );
  const [reason, setReason] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [manualRef, setManualRef] = React.useState<string | null>(null);
  const [phone, setPhone] = React.useState(props.phone ?? "");
  const [error, setError] = React.useState<string | null>(null);

  const { phase, settled } = resolvePaymentState({
    paymentStatus: serverStatus,
    elapsedSeconds: elapsed,
  });

  // The clock. Separate from the poll so the countdown moves every second while
  // the network is touched only every few.
  React.useEffect(() => {
    if (settled) return;
    const id = window.setInterval(() => {
      setElapsed((Date.now() - startedAt) / 1000);
    }, 1000);
    return () => window.clearInterval(id);
  }, [settled, startedAt]);

  // The poll.
  React.useEffect(() => {
    if (settled || !reference) return;
    let cancelled = false;

    async function ask() {
      const res = await checkPaymentStatusAction(reference);
      if (cancelled) return;
      if (res.status === "paid") {
        setServerStatus("paid");
      } else if (res.status === "failed") {
        setServerStatus("failed");
        setReason(res.reason ?? null);
      }
    }

    const id = window.setInterval(ask, POLL_INTERVAL_MS);
    // Ask once immediately too: the callback often lands before the first tick.
    void ask();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [reference, settled]);

  // Success is a destination, not a message. Pushed rather than replaced so the
  // back button returns to the dashboard rather than to a dead checkout.
  React.useEffect(() => {
    if (phase !== "paid") return;
    const id = window.setTimeout(() => router.push(props.successHref), 900);
    return () => window.clearTimeout(id);
  }, [phase, router, props.successHref]);

  async function resend() {
    if (!props.orderId) return;
    setBusy(true);
    setError(null);
    const res = await resendPromptAction(props.orderId, phone);
    setBusy(false);

    if (res.error || !res.order) {
      setError(res.error ?? "Could not send the prompt again.");
      return;
    }
    setReference(res.order.reference);
    setServerStatus("pending");
    setReason(null);
    setStartedAt(Date.now());
    setElapsed(0);
    setAttempts((a) => a + 1);
  }

  async function goManual() {
    if (!props.orderId) return;
    setBusy(true);
    setError(null);
    const res = await requestManualPaymentAction(props.orderId);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setManualRef(res.reference ?? props.orderNumber ?? null);
  }

  const copy = PHASE_COPY[phase as Exclude<CheckoutPhase, "idle">];
  const remaining = secondsRemaining(elapsed);
  const offerManual =
    Boolean(props.paybill) && Boolean(props.orderId) && shouldOfferManual(attempts, phase);

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          className={
            phase === "paid"
              ? "mt-0.5 text-success"
              : phase === "failed"
                ? "mt-0.5 text-danger"
                : "mt-0.5 text-muted"
          }
        >
          {phase === "prompting" ? (
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          ) : phase === "paid" ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          ) : phase === "timed_out" ? (
            <Clock className="h-5 w-5" aria-hidden="true" />
          ) : (
            <TriangleAlert className="h-5 w-5" aria-hidden="true" />
          )}
        </span>

        {/* One live region for the whole status, so a screen reader is told what
            changed rather than having to be steered to it. */}
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-card-title text-foreground">{copy.title}</p>
          <p className="mt-0.5 text-body-sm text-foreground-secondary">
            {reason ?? copy.body}
          </p>
          {phase === "prompting" && (
            <p className="mt-2 flex items-center gap-2 text-caption text-muted">
              <Spinner className="h-3.5 w-3.5" />
              Waiting for {formatKes(props.amountKes)}
              {props.orderNumber ? ` · ${props.orderNumber}` : ""} ·{" "}
              <span className="tabular-nums">{remaining}s</span>
            </p>
          )}
        </div>
      </div>

      {/* A bar rather than a number alone: the point is that the wait is finite,
          and that reads faster as a length than as a digit. */}
      {phase === "prompting" && (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
          role="progressbar"
          aria-valuenow={Math.round(Math.min(elapsed, WAIT_SECONDS))}
          aria-valuemin={0}
          aria-valuemax={WAIT_SECONDS}
          aria-label="Time left to complete the payment"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-slow ease-standard"
            style={{ width: `${Math.min(100, (elapsed / WAIT_SECONDS) * 100)}%` }}
          />
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {(phase === "failed" || phase === "timed_out") && props.orderId && !manualRef && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <Field label="M-Pesa number" hint="Change it if the prompt went to the wrong phone.">
            <Input
              name="phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={resend} loading={busy} loadingText="Sending…">
              Send the prompt again
            </Button>
            {offerManual && (
              <Button variant="secondary" onClick={goManual} disabled={busy}>
                Pay by Paybill instead
              </Button>
            )}
          </div>
        </div>
      )}

      {manualRef && props.paybill && (
        <Alert tone="info" title="Pay by Paybill">
          <span className="flex flex-col gap-1">
            <span>
              Go to M-Pesa, choose Paybill, and use business number{" "}
              <strong className="font-medium">{props.paybill}</strong>
              {props.paybillHint ? ` (${props.paybillHint})` : ""} with account number{" "}
              <strong className="font-medium">{manualRef}</strong> for{" "}
              {formatKes(props.amountKes)}.
            </span>
            <span>
              Send us the confirmation message on WhatsApp and we will activate it. Your
              order is already saved, so there is nothing else to fill in.
            </span>
          </span>
        </Alert>
      )}
    </Card>
  );
}
