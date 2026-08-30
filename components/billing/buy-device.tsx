"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CreditCard, RectangleHorizontal } from "lucide-react";
import { Card, Button, Field, Input, Alert } from "@/components/ui";
import {
  HARDWARE_PRICE_KES,
  DEVICE_LABELS,
  BUNDLED_MONTHS,
  hardwareAmountKes,
  formatKes,
  type DeviceKind,
} from "@/lib/pricing";
import { startOrderAction, type OrderResult } from "@/app/dashboard/billing/order-actions";
import { cn } from "@/lib/cn";

const initial: OrderResult = {};

const PRODUCTS: { code: string; kind: DeviceKind; icon: typeof CreditCard; blurb: string }[] = [
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
    <Button type="submit" loading={pending} loadingText="Starting…">
      Pay {formatKes(amount)}
    </Button>
  );
}

/**
 * Buy hardware (D-019).
 *
 * The total is recomputed on screen as the choice changes, because an M-Pesa
 * prompt for an amount the customer did not expect is where trust in a payment
 * flow is lost. The server prices it again from `lib/pricing.ts` — this number
 * is for the human, never the charge.
 */
export function BuyDevice() {
  const [state, action] = useActionState(startOrderAction, initial);
  const [code, setCode] = React.useState(PRODUCTS[0].code);
  const [quantity, setQuantity] = React.useState(1);

  const selected = PRODUCTS.find((p) => p.code === code) ?? PRODUCTS[0];
  const amount = hardwareAmountKes(selected.kind, Number.isFinite(quantity) ? quantity : 0);

  return (
    <Card padding="md">
      <h2 className="mb-1 text-section-title text-foreground">Get a device</h2>
      <p className="mb-4 text-body-sm text-muted">
        The price includes the first {BUNDLED_MONTHS} months. We will be in touch about
        artwork once your payment clears.
      </p>

      <form action={action} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label text-foreground">Product</legend>
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
                      {formatKes(HARDWARE_PRICE_KES[p.kind])} each
                    </span>
                    <span className="mt-0.5 text-caption text-muted">{p.blurb}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-2">
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
          <Field label="Name for delivery" className="min-w-[10rem] flex-1">
            <Input name="contactName" type="text" placeholder="Who should we ask for?" />
          </Field>
          <Field label="M-Pesa number" required className="min-w-[11rem] flex-1">
            <Input name="phone" type="tel" inputMode="tel" required placeholder="0712 345 678" />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-body-sm text-foreground">
            <span className="text-muted">
              {quantity > 0 ? quantity : 0} × {formatKes(HARDWARE_PRICE_KES[selected.kind])} ={" "}
            </span>
            <span className="font-medium">{formatKes(amount)}</span>
          </p>
          <PayButton amount={amount} />
        </div>

        {state.error && <Alert tone="danger">{state.error}</Alert>}
        {state.success && <Alert tone="success">{state.success}</Alert>}
      </form>
    </Card>
  );
}
