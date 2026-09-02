import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadBillingContext } from "@/lib/billing-context";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { canPublishPage, publishBlockedReason } from "@/lib/entitlement";
import Editor from "./editor";
import type { Block, PageConfig, PublishStatus, Theme } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function EditPage({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const [{ data: page, error: pageError }, { data: links }, billing] = await Promise.all([
    supabase
      .from("smart_pages")
      .select("id, slug, title, mode, redirect_url, config, theme, status, published_at")
      .eq("id", id)
      .single(),
    supabase
      .from("links")
      .select("id, type, label, value, sort_order, is_active")
      .eq("smart_page_id", id)
      .order("sort_order", { ascending: true }),
    loadBillingContext(supabase, profile.account_id),
  ]);

  // `status`, `published_at` and `links.is_active` arrive with migration 0009.
  // Without this the query error would surface as a 404 — telling an owner
  // their live page no longer exists.
  if (isMissingSchemaError(pageError)) {
    return (
      <>
        <PageHeader
          title="Edit profile"
          breadcrumbs={[{ label: "Tap Profiles", href: "/dashboard/profiles" }]}
        />
        <MigrationNotice migration="0009_publish_and_action_state.sql" />
      </>
    );
  }

  if (!page) notFound();

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // "Lapsed" now means every device this account owns has stopped resolving,
  // not that a plan code expired (D-018).
  const planLapsed = billing.summary.billable > 0 && billing.summary.active === 0;

  // Whether this page may go live (D-021). Computed from the account's real
  // holdings, and re-checked in the server action and again by the database —
  // what is decided here is only what the button offers to do.
  const entitlementRow = billing.pages.find((p) => p.id === page.id) ?? {
    id: page.id,
    status: page.status as PublishStatus,
  };
  const canPublish = canPublishPage(entitlementRow, billing.pages, billing.identities);
  const publishBlocked = publishBlockedReason(
    entitlementRow,
    billing.pages,
    billing.identities,
  );

  return (
    <>
      <PageHeader
        title={page.title || `/${page.slug}`}
        description={`taptap.hornbilltech.co.ke/${page.slug}`}
        breadcrumbs={[{ label: "Tap Profiles", href: "/dashboard/profiles" }]}
      />
      <Editor
        pageId={page.id}
        accountId={profile.account_id}
        slug={page.slug}
        siteBase={base}
        initialTitle={page.title ?? ""}
        initialMode={(page.mode as "page" | "redirect") ?? "redirect"}
        initialRedirectUrl={page.redirect_url ?? ""}
        initialConfig={(page.config ?? {}) as PageConfig}
        initialTheme={(page.theme ?? {}) as Theme}
        initialBlocks={(links ?? []) as Block[]}
        initialStatus={((page.status as PublishStatus) ?? "draft")}
        initialPublishedAt={page.published_at ?? null}
        leadCaptureAllowed={billing.entitlements.leadCapture}
        planLapsed={planLapsed}
        canPublish={canPublish}
        publishBlockedReason={publishBlocked}
      />
    </>
  );
}
