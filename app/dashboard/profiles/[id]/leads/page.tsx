import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { LeadInbox } from "@/components/leads/lead-inbox";
import { isMissingSchemaError } from "@/lib/schema-guard";
import {
  parseLeadRange,
  parseLeadStatus,
  leadRangeLabel,
  type Lead,
  type LeadCounts,
} from "@/lib/leads";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

/**
 * Same inbox, scoped to one profile — it shares LeadInbox rather than keeping
 * the separate read-only table it had before, so the two cannot drift.
 */
export default async function ProfileLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; range?: string }>;
}) {
  const { id } = await params;
  const { status, range } = await searchParams;
  const days = parseLeadRange(range);
  const activeStatus = parseLeadStatus(status);

  const supabase = await createServerSupabase();
  const [{ data: page }, { data: leadsData, error }, { data: countsData }] = await Promise.all([
    supabase.from("smart_pages").select("id, slug, title").eq("id", id).single(),
    supabase.rpc("get_leads", {
      p_days: days,
      p_page_id: id,
      p_status: activeStatus ?? null,
      p_limit: 200,
    }),
    supabase.rpc("get_lead_counts", { p_days: days, p_page_id: id }),
  ]);

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader
          title="Leads"
          breadcrumbs={[{ label: "Tap Profiles", href: "/dashboard/profiles" }]}
        />
        <MigrationNotice migration="0012_lead_workflow.sql" />
      </>
    );
  }

  if (!page) notFound();

  const leads = (leadsData ?? []) as Lead[];
  const counts = (countsData ?? { all: 0, by_status: {} }) as LeadCounts;

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${page.title || `/${page.slug}`} · ${leadRangeLabel(days).toLowerCase()}`}
        breadcrumbs={[
          { label: "Tap Profiles", href: "/dashboard/profiles" },
          { label: "Customers", href: "/dashboard/customers" },
        ]}
        actions={
          counts.all > 0 ? (
            <a
              href={`/api/leads/csv?range=${days}&page=${id}${activeStatus ? `&status=${activeStatus}` : ""}`}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </a>
          ) : null
        }
      />
      <LeadInbox leads={leads} counts={counts} activeStatus={activeStatus} />
    </>
  );
}
