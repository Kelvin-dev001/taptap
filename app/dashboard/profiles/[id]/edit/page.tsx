import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import Editor from "./editor";
import type { Block, PageConfig, Theme } from "@/lib/profile";

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

  const { data: page } = await supabase
    .from("smart_pages")
    .select("id, slug, title, mode, redirect_url, config, theme")
    .eq("id", id)
    .single();
  if (!page) notFound();

  const { data: links } = await supabase
    .from("links")
    .select("id, type, label, value, sort_order")
    .eq("smart_page_id", id)
    .order("sort_order", { ascending: true });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <>
      <PageHeader
        title={page.title || `/${page.slug}`}
        description={`Editing /${page.slug}`}
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
      />
    </>
  );
}
