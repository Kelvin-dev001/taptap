import { notFound } from "next/navigation";
import { Users, Download } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, EmptyState, buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { cn } from "@/lib/cn";

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

  const { data: page } = await supabase
    .from("smart_pages")
    .select("id, slug, title")
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
    <>
      <PageHeader
        title="Leads"
        description={page.title || `/${page.slug}`}
        breadcrumbs={[
          { label: "Tap Profiles", href: "/dashboard/profiles" },
          { label: "Customers", href: "/dashboard/customers" },
        ]}
        actions={
          rows.length > 0 ? (
            <a
              href={`/api/leads/${id}/csv`}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download CSV
            </a>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads yet"
          description="Turn on lead capture in this profile's editor and submissions will appear here."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          {/* Table on desktop; the same rows stack as cards on phones so nothing
              depends on horizontal scrolling (finding R3). */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-body-sm">
              <caption className="sr-only">Leads captured from {page.title || page.slug}</caption>
              <thead>
                <tr className="border-b border-border text-left text-caption text-muted">
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Phone</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Email</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Company</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-b border-border align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">{l.name}</td>
                    <td className="px-4 py-2.5">{l.phone}</td>
                    <td className="px-4 py-2.5">{l.email}</td>
                    <td className="px-4 py-2.5">{l.company}</td>
                    <td className="px-4 py-2.5">{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-border sm:hidden">
            {rows.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-card-title text-foreground">
                    {l.name || l.phone || l.email || "Unnamed lead"}
                  </span>
                  <time dateTime={l.created_at} className="shrink-0 text-caption text-muted">
                    {new Date(l.created_at).toLocaleDateString()}
                  </time>
                </div>
                {l.company && <span className="text-caption text-muted">{l.company}</span>}
                {l.phone && <span className="text-body-sm">{l.phone}</span>}
                {l.email && <span className="text-body-sm">{l.email}</span>}
                {l.message && (
                  <p className="mt-1 text-body-sm text-foreground-secondary">{l.message}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
