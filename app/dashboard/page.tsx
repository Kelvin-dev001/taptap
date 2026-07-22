import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import CreateProfileForm from "./create-profile-form";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

type PageRow = {
  id: string;
  slug: string;
  title: string | null;
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
    .select("id, slug, title, redirect_url, is_active")
    .order("created_at", { ascending: false });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const rows = (pages ?? []) as PageRow[];

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

      <section className="rounded-xl border border-neutral-200 p-5">
        <h2 className="mb-4 text-lg font-semibold">Create a redirect link</h2>
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
            <p className="truncate text-sm text-neutral-500">→ {p.redirect_url}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
