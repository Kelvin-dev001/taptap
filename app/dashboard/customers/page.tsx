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

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; range?: string }>;
}) {
  const { status, range } = await searchParams;
  const days = parseLeadRange(range);
  const activeStatus = parseLeadStatus(status);

  const supabase = await createServerSupabase();
  const [{ data: leadsData, error }, { data: countsData }] = await Promise.all([
    supabase.rpc("get_leads", {
      p_days: days,
      p_page_id: null,
      p_status: activeStatus ?? null,
      p_limit: 200,
    }),
    supabase.rpc("get_lead_counts", { p_days: days, p_page_id: null }),
  ]);

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Customers" />
        <MigrationNotice migration="0012_lead_workflow.sql" />
      </>
    );
  }

  const leads = (leadsData ?? []) as Lead[];
  const counts = (countsData ?? { all: 0, by_status: {} }) as LeadCounts;

  return (
    <>
      <PageHeader
        title="Customers"
        description={`People who filled in a lead form on your profiles · ${leadRangeLabel(days).toLowerCase()}`}
        actions={
          counts.all > 0 ? (
            <a
              href={`/api/leads/csv?range=${days}${activeStatus ? `&status=${activeStatus}` : ""}`}
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
