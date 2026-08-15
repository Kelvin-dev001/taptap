import { ImageResponse } from "next/og";
import { getPublicPage } from "@/lib/public-page";
import { normalizeSlug } from "@/lib/slug";
import { resolveTheme } from "@/lib/profile";
import { roleLine } from "@/lib/templates";

export const alt = "Hornbill TapTap profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Link preview card for a smart page.
 *
 * TapTap's distribution is people sharing links — in WhatsApp, in a bio, in a
 * group. A generic grey preview wastes that; a card carrying the business name
 * and its own accent colour makes a shared link look like the business rather
 * than like our platform.
 *
 * Rendered from the published page only, so an unpublished draft never leaks
 * through a preview.
 */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);

  const page = slug ? await getPublicPage(slug) : null;

  // A real page uses its own accent, so a shared link looks like the business.
  // With no page to read, fall back to Hornbill orange rather than the neutral
  // default theme colour, which is a navy that belongs to neither brand.
  const theme = page ? resolveTheme(page.theme) : { ...resolveTheme(null), accent: "#f97316" };
  const config = page?.config ?? {};
  const title = page?.title || (slug ? `/${slug}` : "Hornbill TapTap");
  const subtitle = roleLine(config) || config.bio || "Tap to connect";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: 72,
        }}
      >
        {/* Accent bar carries the business's own colour. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 16,
            background: theme.accent,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 40 }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 700,
              color: "#0f0f0f",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {title.slice(0, 60)}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#525252", lineHeight: 1.3 }}>
            {subtitle.slice(0, 110)}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#141414",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path
                d="M15.2 5.6c-2.9 0-5.3 2.1-5.7 4.9l-2.9 2.2a.9.9 0 0 0 .2 1.5l1.6.7c.5 2.4 2.6 4.2 5.2 4.2 1 0 1.9-.3 2.7-.7l-.6-1.7a3.6 3.6 0 0 1-2.1.6c-1.9 0-3.4-1.4-3.5-3.3l-.1-.9-1.3-.6 2.2-1.7.1-.6a3.9 3.9 0 0 1 7.7.7c0 .6-.1 1.1-.3 1.6l1.8.6c.3-.7.4-1.4.4-2.2 0-3-2.4-5.3-5.4-5.3Z"
                fill="#f97316"
              />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#737373" }}>
            Powered by Hornbill TapTap
          </div>
        </div>
      </div>
    ),
    size,
  );
}
