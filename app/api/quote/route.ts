import { createEdgeClient } from "@/lib/supabase/edge";

export const runtime = "edge";

/**
 * Corporate quote requests.
 *
 * Mirrors `app/api/lead/route.ts` deliberately, down to the honeypot: it is the
 * same problem (a public form writing to a tenant table) and it was solved once
 * already. Validation lives in `submit_quote_request`, a SECURITY DEFINER
 * function, so the table stays unreachable to anon and a client cannot skip the
 * checks by posting straight to PostgREST.
 */
export async function POST(request: Request) {
  let p: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    quantity?: number | string;
    notes?: string;
    website2?: string;
  } = {};

  try {
    p = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // Honeypot: real people never fill this in. Pretend success rather than
  // telling a bot which field gave it away.
  if (p.website2) return new Response(null, { status: 204 });

  if (!p.name?.trim()) return new Response("a name is required", { status: 400 });
  if (!p.email?.trim() && !p.phone?.trim()) {
    return new Response("an email address or phone number is required", { status: 400 });
  }

  const quantity = Number(p.quantity);

  const supabase = createEdgeClient();
  const { error } = await supabase.rpc("submit_quote_request", {
    p_name: p.name,
    p_company: p.company ?? null,
    p_email: p.email ?? null,
    p_phone: p.phone ?? null,
    p_quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : null,
    p_notes: p.notes ?? null,
  });

  if (error) return new Response("error", { status: 400 });

  return new Response(null, { status: 204 });
}
