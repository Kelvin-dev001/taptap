import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { DailyBars, HBars } from "@/components/mini-charts";

export const dynamic = "force-dynamic";

type Analytics = {
  days: number;
  totals: Record<string, number>;
  daily: { date: string; count: number }[];
  devices: Record<string, number>;
  os: Record<string, number>;
  top_blocks: { label: string; count: number }[];
};

const METRICS = ["tap", "scan", "view", "click", "download", "lead"];

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: page } = await supabase
    .from("smart_pages")
    .select("id, slug")
    .eq("id", id)
    .single();
  if (!page) notFound();

  const { data } = await supabase.rpc("get_page_analytics", {
    p_page_id: id,
    p_days: 30,
  });
  const a = (data ?? null) as Analytics | null;

  const totals = a?.totals ?? {};
  const daily = a?.daily ?? [];
  const devices = Object.entries(a?.devices ?? {}).map(([label, value]) => ({
    label,
    value: value as number,
  }));
  const topBlocks = a?.top_blocks ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Dashboard
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Analytics — /{page.slug}</h1>
      <p className="mb-6 text-sm text-neutral-500">Last 30 days</p>

      <section className="mb-8 grid grid-cols-3 gap-3">
        {METRICS.map((m) => (
          <div key={m} className="rounded-xl border border-neutral-200 p-3">
            <div className="text-2xl font-bold tabular-nums">{totals[m] ?? 0}</div>
            <div className="text-xs uppercase text-neutral-500">{m}</div>
          </div>
        ))}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Activity by day</h2>
        <DailyBars data={daily.map((d) => ({ label: d.date, value: d.count }))} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Devices</h2>
        <HBars data={devices} />
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Top buttons</h2>
        <HBars
          data={topBlocks.map((b) => ({ label: b.label, value: b.count }))}
        />
      </section>
    </main>
  );
}
