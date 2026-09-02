"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { CreditCard, RectangleHorizontal, ShieldCheck } from "lucide-react";
import { Card, Button, Field, Input, Alert } from "@/components/ui";
import {
  HARDWARE_PRICE_KES,
  DEVICE_LABELS,
  BUNDLED_MONTHS,
  hardwareAmountKes,
  formatKes,
  type DeviceKind,
} from "@/lib/pricing";
import { PaymentStatus } from "@/components/billing/payment-status";
import { startCheckoutAction, type StartCheckoutResult } from "./actions";
import { cn } from "@/lib/cn";

const initial: StartCheckoutResult = {};

const PRODUCTS: {
  code: string;
  kind: DeviceKind;
  icon: typeof CreditCard;
  blurb: string;
}[] = [
  {
    code: "smart_card",
    kind: "card",
    icon: CreditCard,
    blurb: "A tappable card for one person or one counter.",
  },
  {
    code: "smart_stand",
    kind: "stand",
    icon: RectangleHorizontal,
    blurb: "A countertop stand for reviews, menus or Wi-Fi.",
  },
];

function PayButton({ amount }: { amount: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending} loadingText="Sending prompt…">
      Pay {formatKes(amount)}
    </Button>
  );
}

/**
 * Checkout.
 *
 * Three fields, and two of them are pre-answered. Everything that is not needed
 * to take the money — delivery name, artwork, who the card is for — is asked
 * afterwards, because each field before a payment is a place to abandon it, and
 * we already know the customer well enough to produce their card once they have
 * paid.
 *
 * The total is recomputed on screen as the choice changes, because an M-Pesa
 * prompt for an amount the customer did not expect is where trust in a payment
 * flow is lost. The server prices it again from `lib/pricing.ts` — this number
 * is for the human, never the charge.
 */
export function CheckoutForm({
  defaultProduct,
  defaultQuantity,
  defaultPhone,
  paybill,
  paybillHint,
}: {
  defaultProduct: string;
  defaultQuantity: number;
  defaultPhone: string;
  paybill: string | null;
  paybillHint: string | null;
}) {
  const [state, action] = useActionState(startCheckoutAction, initial);
  const [code, setCode] = React.useState(defaultProduct);
  const [quantity, setQuantity] = React.useState(defaultQuantity);
  const [phone, setPhone] = React.useState(defaultPhone);

  const selected = PRODUCTS.find((p) => p.code === code) ?? PRODUCTS[0];
  const amount = hardwareAmountKes(selected.kind, Number.isFinite(quantity) ? quantity : 0);

  // Once a prompt is out, the form is done. Leaving it on screen invites a
  // second order for money that is already being collected.
  if (state.order) {
    return (
      <PaymentStatus
        reference={state.order.reference}
        amountKes={state.order.amountKes}
        orderId={state.order.id}
        orderNumber={state.order.number}
        phone={phone}
        paybill={paybill}
        paybillHint={paybillHint}
        successHref={`/dashboard/checkout/success?order=${state.order.id}`}
      />
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <Card padding="md" className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label text-foreground">What are you getting?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRODUCTS.map((p) => {
              const Icon = p.icon;
              const active = p.code === code;
              return (
                <label
                  key={p.code}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-fast",
                    active
                      ? "border-primary-strong bg-primary-soft"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="product"
                    value={p.code}
                    checked={active}
                    onChange={() => setCode(p.code)}
                    className="mt-1 h-4 w-4 accent-[#C2560A]"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                      {DEVICE_LABELS[p.kind]}
                    </span>
                    <span className="text-caption text-muted">
                      {formatKes(HARDWARE_PRICE_KES[p.kind])} each, first {BUNDLED_MONTHS}{" "}
                      months included
                    </span>
                    <span className="mt-0.5 text-caption text-muted">{p.blurb}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-3">
          <Field label="How many" required className="w-28">
            <Input
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              required
              value={Number.isFinite(quantity) ? quantity : ""}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
            />
          </Field>
          <Field
            label="M-Pesa number"
            required
            hint="We send the PIN prompt here. 07…, 01… and +254… all work."
            className="min-w-[12rem] flex-1"
          >
            <Input
              name="phone"
              type="tel"
              inputMode="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="text-body-sm text-muted">
              {quantity > 0 ? quantity : 0} × {formatKes(HARDWARE_PRICE_KES[selected.kind])}
            </p>
            <p className="text-page-title text-foreground">{formatKes(amount)}</p>
          </div>
          <PayButton amount={amount} />
        </div>

        {state.error && <Alert tone="danger">{state.error}</Alert>}
      </Card>

      <div className="flex items-start gap-2 text-caption text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>
          One-off M-Pesa payment. We store no card details and set up no standing order,
          so nothing can charge you again on its own. We will ask for your delivery and
          artwork details once this clears.{" "}
          <Link href="/quote" className="underline">
            Buying for a team?
          </Link>
        </p>
      </div>
    </form>
  );
}
