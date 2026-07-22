import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { createEdgeClient } from "@/lib/supabase/edge";
import { isSafeDestination } from "@/lib/url";
import { normalizeSlug } from "@/lib/slug";
import PublicProfile from "@/components/public-profile";
import type { PublicPage } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function SlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug: rawSlug } = await params;
  const sp = await searchParams;
  const slug = normalizeSlug(rawSlug);
  if (!slug) notFound();

  const supabase = createEdgeClient();
  const { data } = await supabase.rpc("get_public_page", { p_slug: slug });
  const page = data as PublicPage | null;
  if (!page) notFound();

  const src = typeof sp.src === "string" ? sp.src : undefined;

  if (page.mode === "redirect") {
    if (!isSafeDestination(page.redirect_url)) notFound();
    const eventType = src === "qr" ? "scan" : "tap";
    // Log after the response so the redirect isn't delayed by the DB write.
    after(async () => {
      await supabase.rpc("log_event", { p_page_id: page.id, p_type: eventType });
    });
    redirect(page.redirect_url as string);
  }

  return <PublicProfile page={page} src={src} />;
}
