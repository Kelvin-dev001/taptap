import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { planFor, formatKes } from "@/lib/plans";
import { mpesaReceiptNumber, mpesaTransactionDate, type PaymentRow } from "@/lib/payments";
import { PrintButton } from "../qr/print-button";

export const dynamic = "force-dynamic";

/**
 * Printable payment receipt.
 *
 * Outside the dashboard shell for the same reason as the QR sheet: nav has no
 * business on a page whose job is to come out of a printer or into a PDF.
 *
 * Only the fields a receipt needs are read out of the stored callback — never
 * the raw payload, which also carries the payer's phone number.
 *
 * Not a tax invoice: TapTap is not registered to issue one, and labelling it as
 * such would be worse than useless to a business filing returns.
 */
export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) notFound();

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes this to the caller's account, so an id from the URL cannot reach
  // another business's payment.
  const [{ data: paymentData }, { data: profile }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, plan_code, provider, reference, amount, currency, status, created_at, raw")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("account_id").eq("id", user.id).single(),
  ]);

  const payment = (paymentData ?? null) as PaymentRow | null;
  if (!payment) notFound();

  const { data: account } = profile
    ? await supabase.from("accounts").select("name").eq("id", profile.account_id).single()
    : { data: null };

  const plan = planFor(payment.plan_code);
  const receiptNo = mpesaReceiptNumber(payment.raw);
  const paidAt = mpesaTransactionDate(payment.raw) ?? new Date(payment.created_at);

  const rows: [string, string][] = [
    ["Receipt for", account?.name ?? "Your business"],
    ["Plan", `${plan.name} — 12 months`],
    ["Amount", formatKes(payment.amount)],
    ["Paid on", paidAt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })],
    ["Method", payment.provider === "mpesa" ? "M-Pesa" : payment.provider],
    ...(receiptNo ? ([["M-Pesa receipt", receiptNo]] as [string, string][]) : []),
    ["Reference", payment.reference],
    ["Status", payment.status === "paid" ? "Paid" : payment.status],
  ];

  return (
    <main className="mx-auto max-w-[640px] p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <h1 className="text-xl font-bold text-foreground">Payment receipt</h1>
        <PrintButton />
      </div>

      <article className="rounded-xl border border-neutral-300 p-8 print:rounded-none print:border-0 print:p-0">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <p className="text-lg font-bold text-black">Hornbill TapTap</p>
            <p className="text-sm text-neutral-500">
              Smart Digital Identity &amp; Customer Engagement
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-black">RECEIPT</p>
            <p className="text-xs text-neutral-500">
              {payment.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </header>

        <dl className="flex flex-col divide-y divide-neutral-100">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-6 py-2.5">
              <dt className="text-sm text-neutral-500">{label}</dt>
              <dd className="text-right text-sm font-medium text-black">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex items-center justify-between border-t-2 border-neutral-900 pt-4">
          <span className="text-sm font-semibold text-black">Total paid</span>
          <span className="text-lg font-bold text-black">{formatKes(payment.amount)}</span>
        </div>

        <footer className="mt-8 border-t border-neutral-200 pt-4">
          <p className="text-xs text-neutral-500">
            This is a payment receipt, not a tax invoice. Retain it for your records.
          </p>
        </footer>
      </article>
    </main>
  );
}
