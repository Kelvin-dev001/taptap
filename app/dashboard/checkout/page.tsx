import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { Alert, Card, buttonVariants } from "@/components/ui";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { PRODUCT_KIND } from "@/lib/orders";
import { DEVICE_LABELS, formatKes, type DeviceKind, type DeliveryRate,
  replacementProductFor,
} from "@/lib/pricing";
import { PaymentStatus } from "@/components/billing/payment-status";
import { CheckoutForm } from "./checkout-form";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
  status: string;
  reference: string;
  provider: string;
  created_at: string;
};

type OrderRow = {
  id: string;
  number: string;
  amount_kes: number;
  quantity: number;
  product_code: string;
  status: string;
  created_at: string;
  payments: PaymentRow[] | null;
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; qty?: string; replaces?: string }>;
}) {
  const { product, qty, replaces } = await searchParams;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/checkout");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  // The card being replaced, when there is one. RLS-scoped, so another
  // account's card simply reads as missing and the page falls back to an
  // ordinary purchase rather than leaking that the id exists.
  const { data: lostCard } = replaces
    ? await supabase
        .from("nfc_tags")
        .select("id, label, serial, variant, is_placeholder")
        .eq("id", replaces)
        .maybeSingle()
    : { data: null };

  const replacing =
    lostCard && !lostCard.is_placeholder
      ? {
          tagId: lostCard.id as string,
          label:
            (lostCard.label as string | null) ||
            (lostCard.serial as string | null) ||
            "your card",
          product: replacementProductFor(lostCard.variant as string | null),
        }
      : null;

  const [{ data: account }, { data: orderData, error: orderError }] = await Promise.all([
    supabase.from("accounts").select("profile").eq("id", profile.account_id).single(),
    // RLS-scoped to this account (orders_select_own, 0017).
    supabase
      .from("orders")
      .select(
        "id, number, amount_kes, quantity, product_code, status, created_at, payments(id, status, reference, provider, created_at)",
      )
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (isMissingSchemaError(orderError)) {
    return (
      <>
        <PageHeader title="Checkout" />
        <MigrationNotice migration="0017_orders.sql" />
      </>
    );
  }

  const orders = (orderData ?? []) as OrderRow[];

  // A pending order the customer can finish rather than start over. Never
  // double-charge: if any payment on the order has cleared, it is not resumable.
  const resumable = orders.find((o) => {
    const payments = o.payments ?? [];
    if (payments.some((p) => p.status === "paid")) return false;
    return payments.some((p) => p.status === "pending" && p.provider === "mpesa");
  });

  const outstanding = resumable
    ? [...(resumable.payments ?? [])]
        .filter((p) => p.status === "pending" && p.provider === "mpesa")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    : null;

  const businessProfile = (account?.profile ?? {}) as { phone?: string; whatsapp?: string };
  const defaultPhone = businessProfile.phone || businessProfile.whatsapp || "";

  const defaultProduct = product && PRODUCT_KIND[product] ? product : "smart_card";
  const parsedQty = parseInt(qty ?? "", 10);
  const defaultQuantity = Number.isFinite(parsedQty) && parsedQty > 0 ? Math.min(parsedQty, 20) : 1;

  // The delivery rates the form prices against. Read here rather than in the
  // client component so the figures arrive with the page: a total that appears a
  // moment after the products do reads as a price that changed its mind.
  //
  // If this comes back empty the zone buttons render nothing and the form cannot
  // be submitted, which is the correct failure — silently charging zero for an
  // upcountry courier is worse than saying delivery is unavailable.
  const { data: rateRows } = await supabase
    .from("delivery_rates")
    .select("zone, label, fee_kes, is_active")
    .eq("is_active", true)
    .order("sort_order");
  const rates = (rateRows ?? []) as DeliveryRate[];

  const paybill = process.env.NEXT_PUBLIC_MPESA_PAYBILL || null;
  const paybillHint = process.env.NEXT_PUBLIC_MPESA_PAYBILL_NAME || null;

  return (
    <>
      <PageHeader
        title="Activate your profile"
        description="Buy the card or stand that makes your Tap Profile live. The price includes your first 12 months."
        breadcrumbs={[{ label: "Billing", href: "/dashboard/billing" }]}
      />

      <div className="flex max-w-2xl flex-col gap-4">
        {resumable && outstanding ? (
          <>
            <Alert tone="info" title={`Finish your payment for ${resumable.number}`}>
              {resumable.quantity} ×{" "}
              {DEVICE_LABELS[(PRODUCT_KIND[resumable.product_code] ?? "card") as DeviceKind]} ·{" "}
              {formatKes(resumable.amount_kes)}. We have not charged you yet, and starting
              again would create a second order for the same thing.
            </Alert>

            <PaymentStatus
              reference={outstanding.reference}
              amountKes={resumable.amount_kes}
              orderId={resumable.id}
              orderNumber={resumable.number}
              phone={defaultPhone}
              paybill={paybill}
              paybillHint={paybillHint}
              successHref={`/dashboard/checkout/success?order=${resumable.id}`}
            />

            <Card padding="sm">
              <p className="text-body-sm text-foreground-secondary">
                Wanted something different? Cancel {resumable.number} from{" "}
                <Link href="/dashboard/orders" className="underline">
                  your orders
                </Link>{" "}
                and come back, or{" "}
                <Link href="/quote" className="underline">
                  ask us for a quote
                </Link>
                .
              </p>
            </Card>
          </>
        ) : (
          <CheckoutForm
            defaultProduct={defaultProduct}
            defaultQuantity={defaultQuantity}
            defaultPhone={defaultPhone}
            paybill={paybill}
            paybillHint={paybillHint}
            rates={rates}
            replacing={replacing}
          />
        )}

        <p className="text-caption text-muted">
          Ordering more than 20, or need an invoice first?{" "}
          <Link href="/quote" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-1")}>
            Talk to sales
          </Link>
        </p>
      </div>
    </>
  );
}
