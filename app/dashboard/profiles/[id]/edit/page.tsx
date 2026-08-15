import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { effectivePlan, subscriptionState } from "@/lib/plans";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
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

  const [{ data: page, error: pageError }, { data: links }, { data: sub }] = await Promise.all([
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
    supabase
      .from("subscriptions")
      .select("plan_code, status, current_period_end")
      .maybeSingle(),
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
  const plan = effectivePlan(sub);
  const state = subscriptionState(sub);
  const planLapsed = state === "expired" || state === "inactive";

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
        initialStatus={((page.status as PublishStatus) ?? "published")}
        initialPublishedAt={page.published_at ?? null}
        leadCaptureAllowed={plan.limits.leadCapture}
        planLapsed={planLapsed}
      />
    </>
  );
}
