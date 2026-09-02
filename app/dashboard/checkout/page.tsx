import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { Alert, Card, buttonVariants } from "@/components/ui";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { PRODUCT_KIND } from "@/lib/orders";
import { DEVICE_LABELS, formatKes, type DeviceKind } from "@/lib/pricing";
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
  searchParams: Promise<{ product?: string; qty?: string }>;
}) {
  const { product, qty } = await searchParams;

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
