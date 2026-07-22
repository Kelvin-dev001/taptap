import { NextResponse, type NextRequest } from "next/server";
import { createEdgeClient } from "@/lib/supabase/edge";
import { isSafeDestination } from "@/lib/url";
import { normalizeSlug } from "@/lib/slug";

// The tap/redirect service. Must be fast and must not cold-start — run on edge.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  if (!slug) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = createEdgeClient();

  const { data, error } = await supabase.rpc("resolve_slug", { p_slug: slug });
  const page = Array.isArray(data) ? data[0] : data;

  if (error || !page) {
    return new NextResponse("This TapTap link is not active.", { status: 404 });
  }

  // Page mode rendering arrives in Sprint 2. For now only redirect mode is live.
  if (page.mode !== "redirect" || !isSafeDestination(page.redirect_url)) {
    return new NextResponse("This TapTap link is not ready yet.", { status: 404 });
  }

  // A QR scan carries ?src=qr; anything else is treated as an NFC tap.
  const src = request.nextUrl.searchParams.get("src");
  const eventType = src === "qr" ? "scan" : "tap";

  // Log the interaction. Awaited for correctness on edge; Sprint 2 will move
  // this to a cached-resolve + fire-and-forget model to trim latency.
  await supabase.rpc("log_event", {
    p_page_id: page.id,
    p_type: eventType,
    p_referrer: request.headers.get("referer"),
  });

  return NextResponse.redirect(page.redirect_url, 302);
}
