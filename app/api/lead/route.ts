import { createEdgeClient } from "@/lib/supabase/edge";

export const runtime = "edge";

export async function POST(request: Request) {
  let p: {
    pageId?: string;
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
    message?: string;
    website2?: string;
  } = {};
  try {
    p = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (!p.pageId) return new Response("bad request", { status: 400 });

  // Honeypot: real users never fill this. Pretend success.
  if (p.website2) return new Response(null, { status: 204 });

  if (!p.name && !p.phone && !p.email) {
    return new Response("need a contact detail", { status: 400 });
  }

  const supabase = createEdgeClient();
  const { error } = await supabase.rpc("submit_lead", {
    p_page_id: p.pageId,
    p_name: p.name ?? null,
    p_phone: p.phone ?? null,
    p_email: p.email ?? null,
    p_company: p.company ?? null,
    p_message: p.message ?? null,
  });

  if (error) return new Response("error", { status: 400 });
  return new Response(null, { status: 204 });
}
