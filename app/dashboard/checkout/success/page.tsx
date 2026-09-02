import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleCheck, Palette, Truck, Rocket } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { Card, Alert, Badge, buttonVariants } from "@/components/ui";
import { DEVICE_LABELS, formatKes, BUNDLED_MONTHS, type DeviceKind } from "@/lib/pricing";
import { PRODUCT_KIND } from "@/lib/orders";
import { mpesaReceiptNumber } from "@/lib/payments";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

type PaymentRow = { id: string; status: string; provider: string; raw: unknown };

/**
 * What happens after the money lands.
 *
 * Short on purpose. The customer has just paid and wants two things confirmed:
 * that we have their money, and that something physical is now coming. Anything
 * else on this screen competes with the one action worth taking, which is
 * publishing the page they built.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) redirect("/dashboard/orders");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS-scoped: another account's order reads as missing.
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, number, quantity, amount_kes, product_code, created_at, payments(id, status, provider, raw)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) notFound();

  const payments = (order.payments ?? []) as PaymentRow[];
  const paid = payments.find((p) => p.status === "paid");
  const receipt = paid ? mpesaReceiptNumber(paid.raw) : null;
  const kind: DeviceKind = PRODUCT_KIND[order.product_code] ?? "card";

  // The page they were most likely building when they came here.
  const { data: drafts } = await supabase
    .from("smart_pages")
    .select("id, slug, title, status")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1);
  const draft = (drafts ?? [])[0] as
    | { id: string; slug: string; title: string | null }
    | undefined;

  return (
    <>
      <PageHeader
        title={paid ? "You are activated" : "Payment received"}
        breadcrumbs={[{ label: "Orders", href: "/dashboard/orders" }]}
      />

      <div className="flex max-w-2xl flex-col gap-4">
        <Card padding="md" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <CircleCheck className="mt-0.5 h-6 w-6 shrink-0 text-success" aria-hidden="true" />
              <div>
                <p className="text-card-title text-foreground">
                  {order.quantity} × {DEVICE_LABELS[kind]}
                </p>
                <p className="text-caption text-muted">
                  {order.number} · {formatKes(order.amount_kes)} · includes {BUNDLED_MONTHS}{" "}
                  months
                </p>
              </div>
            </div>
            <Badge variant="success" dot>
              Paid
            </Badge>
          </div>

          {receipt ? (
            <p className="text-body-sm text-foreground-secondary">
              M-Pesa receipt{" "}
              <span className="font-medium tabular-nums text-foreground">{receipt}</span>. It is
              saved in your{" "}
              <Link href="/dashboard/billing" className="underline">
                payment history
              </Link>
              .
            </p>
          ) : (
            <p className="text-body-sm text-muted">
              Safaricom sends the receipt code a moment after the payment. It will appear in
              your payment history shortly.
            </p>
          )}
        </Card>

        <Card padding="md" className="flex flex-col gap-3">
          <h2 className="text-section-title text-foreground">What happens next</h2>
          <ol className="flex flex-col gap-3">
            <Step icon={Rocket} title="Publish your profile">
              Your identity is active, so your Tap Profile can go live now. You can keep
              editing it afterwards, and changes go out when you publish again.
            </Step>
            <Step icon={Palette} title="We design your card">
              We will contact you about artwork and what you want printed. Nothing is
              produced until you approve the design.
            </Step>
            <Step icon={Truck} title="We make it and send it">
              Your card is printed, encoded and delivered. Follow it from{" "}
              <Link href="/dashboard/orders" className="underline">
                your orders
              </Link>{" "}
              at any point.
            </Step>
          </ol>
        </Card>

        {/* Your twelve months started at payment, not at delivery (D-019). Saying
            so here is the honest moment to say it, rather than in a renewal
            email eleven months from now. */}
        <Alert tone="info" title="Your 12 months start today">
          Service runs from this payment rather than from delivery. We will remind you
          before it is due, and nothing renews on its own.
        </Alert>

        <div className="flex flex-wrap gap-2">
          {draft ? (
            <Link
              href={`/dashboard/profiles/${draft.id}/edit`}
              className={cn(buttonVariants())}
            >
              Publish {draft.title || `/${draft.slug}`}
            </Link>
          ) : (
            <Link href="/dashboard/profiles" className={cn(buttonVariants())}>
              Build your profile
            </Link>
          )}
          <Link
            href="/dashboard/orders"
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Track this order
          </Link>
        </div>
      </div>
    </>
  );
}

function Step({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
        <Icon className="h-4 w-4 text-primary-strong" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-body-sm font-medium text-foreground">{title}</span>
        <span className="block text-body-sm text-foreground-secondary">{children}</span>
      </span>
    </li>
  );
}
