import Link from "next/link";
import { IdCard, ExternalLink, Pencil, ChartNoAxesColumn, Users, QrCode } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, Badge, EmptyState, buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { loadBillingContext } from "@/lib/billing-context";
import { publicPageState } from "@/lib/entitlement";
import { DraftBanner } from "@/components/profile/draft-banner";
import { cn } from "@/lib/cn";
import { templateOf, templateDef } from "@/lib/templates";
import type { PageConfig } from "@/lib/profile";
import CreateProfileForm from "./create-profile-form";
import { ProfileActionsMenu } from "./profile-actions-menu";
import { parseProfileFilter } from "@/lib/profile-filter";
import { TypeFilter } from "./type-filter";

export const dynamic = "force-dynamic";

type PageRow = {
  id: string;
  slug: string;
  title: string | null;
  mode: "page" | "redirect";
  redirect_url: string | null;
  is_active: boolean;
  status: "draft" | "published";
  config: PageConfig | null;
};

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const filter = parseProfileFilter(type);

  // Auth is enforced once in app/dashboard/layout.tsx.
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.user?.id ?? "")
    .maybeSingle();

  const [{ data: pages, error: pagesError }, billing] = await Promise.all([
    supabase
      .from("smart_pages")
      .select("id, slug, title, mode, redirect_url, is_active, status, config")
      .order("created_at", { ascending: false }),
    loadBillingContext(supabase, profile?.account_id),
  ]);

  // `status` arrives with migration 0009; without this guard the list would
  // render as "no links yet" for an account that has plenty.
  if (isMissingSchemaError(pagesError)) {
    return (
      <>
        <PageHeader title="Tap Profiles" />
        <MigrationNotice migration="0009_publish_and_action_state.sql" />
      </>
    );
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const all = (pages ?? []) as PageRow[];

  // What the public would actually see for each page (D-021). Three states, not
  // two: "draft" has never been public, "inactive" was and stopped because the
  // account no longer owns a slot for it. Merging them would tell an owner whose
  // card lapsed that their page was never finished.
  const stateOf = (p: PageRow) =>
    publicPageState(
      billing.pages.find((row) => row.id === p.id) ?? { id: p.id, status: p.status },
      billing.pages,
      billing.identities,
    );

  const hasBlockedDraft = all.some((p) => stateOf(p) === "draft") && billing.slots.free === 0;

  // Filtered in memory: the list is per-account and small, and `template` lives
  // inside the config jsonb, so a SQL filter would buy nothing here.
  const kindOf = (p: PageRow) =>
    p.mode === "redirect" ? "redirect" : templateOf(p.config);
  const rows = filter === "all" ? all : all.filter((p) => kindOf(p) === filter);

  return (
    <>
      <PageHeader
        title="Tap Profiles"
        description="Business pages and personal cards — each is a permanent link that any NFC card or QR code can point to."
        actions={<TypeFilter value={filter} />}
      />

      {hasBlockedDraft && <DraftBanner className="mb-4" />}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section className="flex flex-col gap-3" aria-labelledby="existing-heading">
          <h2 id="existing-heading" className="text-section-title text-foreground">
            Your links
          </h2>

          {rows.length === 0 ? (
            <EmptyState
              icon={IdCard}
              title={all.length === 0 ? "No links yet" : "Nothing of this type yet"}
              description={
                all.length === 0
                  ? "Create your first link and point it at a Google review, WhatsApp, or a full smart page."
                  : "Change the filter, or create one using the form."
              }
            />
          ) : (
            rows.map((p) => {
              const state = stateOf(p);
              const isLive = p.is_active && state === "live";

              return (
              <Card key={p.id} padding="sm" className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    {/* A draft's slug does not resolve, so its title is not a
                        link to it. Linking anyway would open a 404 and read as
                        broken rather than as unpublished. */}
                    {isLive ? (
                      <a
                        href={`${base}/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-card-title text-foreground hover:text-primary-strong"
                      >
                        {p.title || `/${p.slug}`}
                      </a>
                    ) : (
                      <span className="truncate text-card-title text-foreground">
                        {p.title || `/${p.slug}`}
                      </span>
                    )}
                    <span className="truncate text-caption text-muted">
                      {base ? `${base.replace(/^https?:\/\//, "")}/${p.slug}` : `/${p.slug}`}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* Two independent states: publish status is one axis,
                        `is_active` the owner's on/off switch, and entitlement a
                        third. Shown as one badge because an owner cares what the
                        public sees, not which of three reasons produced it. */}
                    <Badge
                      variant={
                        !p.is_active
                          ? "neutral"
                          : state === "live"
                            ? "success"
                            : state === "inactive"
                              ? "danger"
                              : "warning"
                      }
                      dot
                    >
                      {!p.is_active
                        ? "Switched off"
                        : state === "live"
                          ? "Live"
                          : state === "inactive"
                            ? "Not live"
                            : "Draft"}
                    </Badge>
                    <ProfileActionsMenu
                      pageId={p.id}
                      name={p.title || `/${p.slug}`}
                      isActive={p.is_active}
                    />
                  </div>
                </div>

                <p className="truncate text-caption text-muted">
                  {p.mode === "redirect"
                    ? `Redirects to ${p.redirect_url}`
                    : templateDef(templateOf(p.config)).label}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <ProfileAction href={`/dashboard/profiles/${p.id}/edit`} icon={Pencil}>
                    Edit
                  </ProfileAction>
                  <ProfileAction
                    href={`/dashboard/profiles/${p.id}/analytics`}
                    icon={ChartNoAxesColumn}
                  >
                    Analytics
                  </ProfileAction>
                  <ProfileAction href={`/dashboard/profiles/${p.id}/leads`} icon={Users}>
                    Leads
                  </ProfileAction>

                  {/* Sharing a link that does not resolve is worse than not
                      offering to. The QR encoder itself needs no gate: it turns
                      a string into a picture and reveals nothing that is not
                      already public. What is gated is handing someone a code
                      that leads nowhere. */}
                  {isLive ? (
                    <>
                      <ProfileAction href={`/api/qr/${p.slug}`} icon={QrCode}>
                        QR code
                      </ProfileAction>
                      <a
                        href={`${base}/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-caption text-foreground-secondary transition-colors duration-fast hover:bg-surface-sunken hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        Open
                        <span className="sr-only">{p.title || p.slug} in a new tab</span>
                      </a>
                    </>
                  ) : (
                    <Link
                      href="/dashboard/checkout"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "gap-1.5 px-2 text-caption text-primary-strong",
                      )}
                    >
                      <QrCode className="h-3.5 w-3.5" aria-hidden />
                      Activate to share
                    </Link>
                  )}
                </div>
              </Card>
              );
            })
          )}
        </section>

        <Card padding="md" className="lg:sticky lg:top-20">
          <h2 className="mb-4 text-section-title text-foreground">Create a link</h2>
          <CreateProfileForm />
        </Card>
      </div>
    </>
  );
}

/**
 * A link that looks like a ghost button. Uses `buttonVariants` rather than
 * wrapping <Button>, so the rendered element stays an anchor — these navigate,
 * and a <button> would be the wrong role (the mistake UI-0 logged as A5).
 */
function ProfileAction({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 px-2 text-caption")}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </Link>
  );
}
