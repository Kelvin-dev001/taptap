import Link from "next/link";
import { Users, Phone, Mail, MessageCircle } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, EmptyState, Badge, buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  smart_page_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  message: string | null;
  created_at: string;
};

/**
 * Unified lead inbox across every Tap Profile.
 *
 * No new RPC is needed: `leads_select_own` already scopes a plain select to the
 * caller's pages, so this is the same data the per-profile view shows, just not
 * filtered by page. The richer workflow — detail view, status/stage, follow-up
 * actions — is UI-8.
 */
export default async function CustomersPage() {
  const supabase = await createServerSupabase();

  const [{ data: leads }, { data: pages }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, smart_page_id, name, phone, email, company, message, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("smart_pages").select("id, slug, title"),
  ]);

  const rows = (leads ?? []) as Lead[];
  const pageName = new Map(
    (pages ?? []).map((p) => [p.id, p.title || `/${p.slug}`] as const),
  );

  return (
    <>
      <PageHeader
        title="Customers"
        description={
          rows.length > 0
            ? `${rows.length} lead${rows.length === 1 ? "" : "s"} captured across your profiles.`
            : "People who filled in a lead form on one of your Tap Profiles."
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads yet"
          description="Turn on lead capture in a smart page's editor and submissions will land here."
          action={
            <Link href="/dashboard/profiles" className={cn(buttonVariants())}>
              Go to Tap Profiles
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((lead) => (
            <Card key={lead.id} padding="sm" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-card-title text-foreground">
                    {lead.name || lead.phone || lead.email || "Unnamed lead"}
                  </span>
                  {lead.company && (
                    <span className="truncate text-caption text-muted">{lead.company}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="neutral">{pageName.get(lead.smart_page_id) ?? "Unknown"}</Badge>
                  <time
                    dateTime={lead.created_at}
                    className="text-caption text-muted"
                  >
                    {new Date(lead.created_at).toLocaleDateString()}
                  </time>
                </div>
              </div>

              {lead.message && (
                <p className="text-body-sm text-foreground-secondary">{lead.message}</p>
              )}

              {/* Real contact actions — these are links, so they open the phone's
                  dialer, mail client or WhatsApp directly. */}
              <div className="flex flex-wrap items-center gap-1">
                {lead.phone && (
                  <>
                    <ContactLink href={`tel:${lead.phone}`} icon={Phone}>
                      {lead.phone}
                    </ContactLink>
                    <ContactLink
                      href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                      icon={MessageCircle}
                    >
                      WhatsApp
                    </ContactLink>
                  </>
                )}
                {lead.email && (
                  <ContactLink href={`mailto:${lead.email}`} icon={Mail}>
                    {lead.email}
                  </ContactLink>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function ContactLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 px-2 text-caption")}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </a>
  );
}
