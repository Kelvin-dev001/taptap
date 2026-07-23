import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  message: string | null;
  created_at: string;
};

export default async function LeadsPage({
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

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, phone, email, company, message, created_at")
    .eq("smart_page_id", id)
    .order("created_at", { ascending: false });
  const rows = (leads ?? []) as Lead[];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Dashboard
      </Link>
      <div className="mb-6 mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads — /{page.slug}</h1>
        {rows.length > 0 && (
          <a
            href={`/api/leads/${id}/csv`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Download CSV
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No leads yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-neutral-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Company</th>
                <th className="py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b align-top">
                  <td className="whitespace-nowrap py-2 pr-4">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-4">{l.name}</td>
                  <td className="py-2 pr-4">{l.phone}</td>
                  <td className="py-2 pr-4">{l.email}</td>
                  <td className="py-2 pr-4">{l.company}</td>
                  <td className="py-2">{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
