import { after } from "next/server";
import { createEdgeClient } from "@/lib/supabase/edge";
import { notifyNewLead } from "@/lib/notifications/notify-lead";

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
  const { data: leadId, error } = await supabase.rpc("submit_lead", {
    p_page_id: p.pageId,
    p_name: p.name ?? null,
    p_phone: p.phone ?? null,
    p_email: p.email ?? null,
    p_company: p.company ?? null,
    p_message: p.message ?? null,
  });

  if (error) return new Response("error", { status: 400 });

  // Notify after the response, not before it.
  //
  // The lead is already saved, so the person who filled in the form is done —
  // making them wait on our mail provider would add latency to the one moment
  // that matters, on a mobile connection, for their benefit not ours. `after`
  // also means a slow or failing Resend cannot turn a captured lead into an
  // error on a customer's screen.
  //
  // Older leads created before migration 0014 have no id here; the guard keeps
  // that a no-op rather than a crash.
  if (typeof leadId === "string") {
    after(async () => {
      await notifyNewLead(leadId);
    });
  }

  return new Response(null, { status: 204 });
}
