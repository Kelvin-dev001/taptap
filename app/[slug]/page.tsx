import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import { createEdgeClient } from "@/lib/supabase/edge";
import { isSafeDestination } from "@/lib/url";
import { normalizeSlug } from "@/lib/slug";
import { parseUA } from "@/lib/ua";
import PublicProfile from "@/components/public-profile";
import type { PublicPage } from "@/lib/profile";

export const dynamic = "force-dynamic";

/**
 * Per-profile metadata.
 *
 * UI-4 added SEO fields to the builder and nothing ever read them, so every
 * shared link previewed as "Hornbill TapTap" — on a product whose entire
 * distribution is people sharing links in WhatsApp, that is the single most
 * visible thing a profile has.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  if (!slug) return {};

  const supabase = createEdgeClient();
  const { data } = await supabase.rpc("get_public_page", { p_slug: slug });
  const page = data as PublicPage | null;
  // A redirect-mode link is never rendered, so it needs no preview.
  if (!page || page.mode === "redirect") return {};

  const config = page.config ?? {};
  const title = config.seo?.title?.trim() || page.title || `/${slug}`;
  const description =
    config.seo?.description?.trim() ||
    config.bio?.trim() ||
    config.tagline?.trim() ||
    `Tap to connect with ${page.title ?? "this business"}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "Hornbill TapTap",
    },
    twitter: { card: "summary_large_image", title, description },
    // A smart page is a live shopfront: it should be indexable, unlike the
    // dashboard behind it.
    robots: { index: true, follow: true },
  };
}

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

    // An NFC tap was already recorded by /t/<token>, which is the only place
    // that knows which card was involved. Logging again here would double-count
    // every tap and attribute none of them.
    if (src !== "nfc") {
      const eventType = src === "qr" ? "scan" : "tap";
      const h = await headers();
      const { device, os } = parseUA(h.get("user-agent"));
      const country = h.get("x-vercel-ip-country");
      const region = h.get("x-vercel-ip-country-region");
      // Log after the response so the redirect isn't delayed by the DB write.
      after(async () => {
        await supabase.rpc("log_event", {
          p_page_id: page.id,
          p_type: eventType,
          p_device: device,
          p_os: os,
          p_country: country,
          p_region: region,
          p_source: src === "qr" ? "qr" : "direct",
        });
      });
    }

    redirect(page.redirect_url as string);
  }

  return <PublicProfile page={page} src={src} />;
}
