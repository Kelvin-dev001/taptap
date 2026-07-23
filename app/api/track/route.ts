import { createEdgeClient } from "@/lib/supabase/edge";
import { parseUA } from "@/lib/ua";

export const runtime = "edge";

const ALLOWED = new Set(["view", "click", "download", "scan", "tap"]);

export async function POST(request: Request) {
  let payload: { pageId?: string; type?: string; linkId?: string } = {};
  try {
    payload = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const { pageId, type, linkId } = payload;
  if (!pageId || !type || !ALLOWED.has(type)) {
    return new Response("bad request", { status: 400 });
  }

  const { device, os } = parseUA(request.headers.get("user-agent"));
  const country = request.headers.get("x-vercel-ip-country");

  const supabase = createEdgeClient();
  await supabase.rpc("log_event", {
    p_page_id: pageId,
    p_type: type,
    p_link_id: linkId ?? null,
    p_device: device,
    p_os: os,
    p_country: country,
  });

  return new Response(null, { status: 204 });
}
