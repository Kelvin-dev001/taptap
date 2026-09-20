"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { CreditCard, RectangleHorizontal, Sparkles, ShieldCheck } from "lucide-react";
import { Card, Button, Field, Input, Alert } from "@/components/ui";
import {
  SELLABLE_PRODUCTS,
  BUNDLED_MONTHS,
  deliveryFeeKes,
  orderTotalKes,
  formatKes,
  type ProductCode,
  type DeliveryRate,
} from "@/lib/pricing";
import { PaymentStatus } from "@/components/billing/payment-status";
import { startCheckoutAction, type StartCheckoutResult } from "./actions";
import { cn } from "@/lib/cn";

const initial: StartCheckoutResult = {};

/** Icons only. What each product IS lives in lib/pricing.ts (D-018). */
const PRODUCT_ICONS: Record<ProductCode, typeof CreditCard> = {
  smart_card: CreditCard,
  smart_card_premium: Sparkles,
  smart_stand: RectangleHorizontal,
  smart_card_replacement: CreditCard,
  smart_card_premium_replacement: Sparkles,
};

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
 * Four fields, and three of them are pre-answered or one tap. Everything that is
 * not needed to take the money — the recipient, the exact address, artwork — is
 * still asked afterwards, because each field before a payment is a place to
 * abandon it.
 *
 * The exception, added in Sprint 8 (D-028), is WHERE it is going. A rider drop in
 * Mombasa or Nairobi is free and anywhere else is a courier, so the amount cannot
 * be computed without it. It is one radio group, and it changes the total on
 * screen as it is answered rather than surprising anybody at the PIN prompt.
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
  rates,
}: {
  defaultProduct: string;
  defaultQuantity: number;
  defaultPhone: string;
  paybill: string | null;
  paybillHint: string | null;
  /** From `delivery_rates`. The table is the source of truth for the figure. */
  rates: DeliveryRate[];
}) {
  const [state, action] = useActionState(startCheckoutAction, initial);
  const [code, setCode] = React.useState(defaultProduct);
  const [quantity, setQuantity] = React.useState(defaultQuantity);
  const [phone, setPhone] = React.useState(defaultPhone);
  const [zone, setZone] = React.useState("");
  const [town, setTown] = React.useState("");

  const selected =
    SELLABLE_PRODUCTS.find((p) => p.code === code) ?? SELLABLE_PRODUCTS[0];
  const qty = Number.isFinite(quantity) ? quantity : 0;
  const deliveryFee = zone ? deliveryFeeKes(zone, rates) : 0;
  const amount = orderTotalKes(selected, qty, deliveryFee);

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
          <div className="grid gap-2 sm:grid-cols-3">
            {SELLABLE_PRODUCTS.map((p) => {
              const Icon = PRODUCT_ICONS[p.code];
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
                      {p.name}
                    </span>
                    <span className="text-caption text-muted">
                      {formatKes(p.priceKes)} each, first {BUNDLED_MONTHS} months included
                    </span>
                    <span className="mt-0.5 text-caption text-muted">{p.blurb}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Where it is going (D-028).
            In front of the payment because it changes the amount, and nothing
            else about delivery is asked here: the recipient and the exact
            address are collected after the money clears, and stay editable from
            the order page until it ships. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label text-foreground">Where should we deliver?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {rates.map((rate) => {
              const active = rate.zone === zone;
              return (
                <label
                  key={rate.zone}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-fast",
                    active
                      ? "border-primary-strong bg-primary-soft"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="deliveryZone"
                    value={rate.zone}
                    checked={active}
                    onChange={() => setZone(rate.zone)}
                    required
                    className="mt-1 h-4 w-4 accent-[#C2560A]"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-sm font-medium text-foreground">{rate.label}</span>
                    <span className="text-caption text-muted">
                      {rate.fee_kes > 0 ? `${formatKes(rate.fee_kes)} delivery` : "Free delivery"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {/* Only the zone we cannot guess the town from. Asking every customer
              to type a town we already know is a field for nothing. */}
          {zone === "other" && (
            <Field label="Which town" required className="mt-1 max-w-sm">
              <Input
                name="deliveryTown"
                required
                value={town}
                onChange={(e) => setTown(e.target.value)}
                placeholder="Kisumu"
                autoComplete="address-level2"
              />
            </Field>
          )}
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
              {qty} × {formatKes(selected.priceKes)}
              {zone && (deliveryFee > 0 ? ` + ${formatKes(deliveryFee)} delivery` : " + free delivery")}
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
          so nothing can charge you again on its own. We will ask who to address the
          parcel to once this clears.{" "}
          <Link href="/quote" className="underline">
            Buying for a team?
          </Link>
        </p>
      </div>
    </form>
  );
}
