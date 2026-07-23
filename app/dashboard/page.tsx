import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import CreateProfileForm from "./create-profile-form";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

type PageRow = {
  id: string;
  slug: string;
  title: string | null;
  mode: "page" | "redirect";
  redirect_url: string | null;
  is_active: boolean;
};

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pages } = await supabase
    .from("smart_pages")
    .select("id, slug, title, mode, redirect_url, is_active")
    .order("created_at", { ascending: false });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const rows = (pages ?? []) as PageRow[];

  const { data: overviewData } = await supabase.rpc("get_account_overview", {
    p_days: 30,
  });
  const overview = (overviewData ?? {}) as {
    pages?: number;
    totals?: Record<string, number>;
    leads?: number;
  };
  const t = overview.totals ?? {};
  const summary: { label: string; value: number }[] = [
    { label: "Taps", value: t.tap ?? 0 },
    { label: "Scans", value: t.scan ?? 0 },
    { label: "Views", value: t.view ?? 0 },
    { label: "Clicks", value: t.click ?? 0 },
    { label: "Leads", value: overview.leads ?? 0 },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your TapTap links</h1>
        <form action={signOutAction}>
          <button className="text-sm text-neutral-500 hover:text-neutral-900">
            Sign out
          </button>
        </form>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">
          Last 30 days
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {summary.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-neutral-200 p-3 text-center"
            >
              <div className="text-xl font-bold tabular-nums">{s.value}</div>
              <div className="text-xs text-neutral-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-5">
        <h2 className="mb-4 text-lg font-semibold">Create a link</h2>
        <CreateProfileForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Existing links</h2>
        {rows.length === 0 && (
          <p className="text-sm text-neutral-500">No links yet. Create your first above.</p>
        )}
        {rows.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4"
          >
            <div className="flex items-center justify-between">
              <a
                href={`${base}/${p.slug}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                {base ? `${base.replace(/^https?:\/\//, "")}/${p.slug}` : `/${p.slug}`}
              </a>
              <span
                className={`text-xs ${p.is_active ? "text-green-600" : "text-neutral-400"}`}
              >
                {p.is_active ? "active" : "inactive"}
              </span>
            </div>
            {p.title && <p className="text-sm text-neutral-600">{p.title}</p>}
            {p.mode === "redirect" ? (
              <p className="truncate text-sm text-neutral-500">→ {p.redirect_url}</p>
            ) : (
              <p className="text-sm text-neutral-500">Smart page</p>
            )}
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              <Link
                href={`/dashboard/${p.id}/edit`}
                className="text-blue-600 hover:underline"
              >
                Edit
              </Link>
              <Link
                href={`/dashboard/${p.id}/analytics`}
                className="text-blue-600 hover:underline"
              >
                Analytics
              </Link>
              <Link
                href={`/dashboard/${p.id}/leads`}
                className="text-blue-600 hover:underline"
              >
                Leads
              </Link>
              <a
                href={`/api/qr/${p.slug}`}
                className="text-blue-600 hover:underline"
              >
                QR code
              </a>
              <a
                href={`${base}/${p.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                Open
              </a>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
