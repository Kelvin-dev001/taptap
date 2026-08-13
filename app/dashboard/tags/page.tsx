import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { rebindTagAction, setTagStatusAction } from "./actions";

export const dynamic = "force-dynamic";

type Tag = {
  id: string;
  token: string;
  status: string;
  smart_page_id: string | null;
};
type PageOpt = { id: string; slug: string; title: string | null };

export default async function TagsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tags } = await supabase
    .from("nfc_tags")
    .select("id, token, status, smart_page_id")
    .order("created_at", { ascending: false });
  const { data: pages } = await supabase
    .from("smart_pages")
    .select("id, slug, title")
    .order("created_at", { ascending: false });

  const tagRows = (tags ?? []) as Tag[];
  const pageOpts = (pages ?? []) as PageOpt[];
  const pageName = (id: string | null) => {
    const p = pageOpts.find((x) => x.id === id);
    return p ? p.title || `/${p.slug}` : "—";
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Dashboard
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Your cards</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Tap a new card to claim it. Here you can repoint or disable claimed cards.
      </p>

      {tagRows.length === 0 ? (
        <p className="text-sm text-neutral-500">No cards claimed yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tagRows.map((tg) => (
            <div key={tg.id} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-neutral-500">
                  …{tg.token.slice(-8)}
                </span>
                <span
                  className={`text-xs ${
                    tg.status === "assigned"
                      ? "text-green-600"
                      : "text-neutral-400"
                  }`}
                >
                  {tg.status}
                </span>
              </div>
              <p className="mt-1 text-sm">
                Points to:{" "}
                <span className="font-medium">{pageName(tg.smart_page_id)}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action={rebindTagAction} className="flex items-center gap-2">
                  <input type="hidden" name="tagId" value={tg.id} />
                  <select
                    name="pageId"
                    required
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                  >
                    {pageOpts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title || `/${p.slug}`}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-lg border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50">
                    Repoint
                  </button>
                </form>
                <form action={setTagStatusAction}>
                  <input type="hidden" name="tagId" value={tg.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={tg.status === "disabled" ? "assigned" : "disabled"}
                  />
                  <button className="rounded-lg border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50">
                    {tg.status === "disabled" ? "Enable" : "Disable"}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
