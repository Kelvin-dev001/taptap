import { createEdgeClient } from "@/lib/supabase/edge";
import { parseUA } from "@/lib/ua";

export const runtime = "edge";

const ALLOWED = new Set(["view", "click", "download", "scan", "tap"]);
const SOURCES = new Set(["nfc", "qr", "direct", "web"]);

export async function POST(request: Request) {
  let payload: {
    pageId?: string;
    type?: string;
    linkId?: string;
    source?: string;
  } = {};
  try {
    payload = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const { pageId, type, linkId, source } = payload;
  if (!pageId || !type || !ALLOWED.has(type)) {
    return new Response("bad request", { status: 400 });
  }

  const { device, os } = parseUA(request.headers.get("user-agent"));
  const country = request.headers.get("x-vercel-ip-country");
  // Audit item B11: the column has existed since 0001 and was never written.
  const region = request.headers.get("x-vercel-ip-country-region");

  const supabase = createEdgeClient();
  await supabase.rpc("log_event", {
    p_page_id: pageId,
    p_type: type,
    p_link_id: linkId ?? null,
    p_device: device,
    p_os: os,
    p_country: country,
    p_region: region,
    // Only accept a source the schema allows; anything else is recorded as
    // unknown rather than guessed at.
    p_source: source && SOURCES.has(source) ? source : null,
  });

  return new Response(null, { status: 204 });
}
