import { createServerSupabase } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

type LeadRow = {
  created_at: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  message: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  // RLS ensures only the owner's leads are returned.
  const { data: leads } = await supabase
    .from("leads")
    .select("created_at, name, phone, email, company, message")
    .eq("smart_page_id", id)
    .order("created_at", { ascending: false });

  const rows = ((leads ?? []) as LeadRow[]).map((l) => [
    l.created_at,
    l.name,
    l.phone,
    l.email,
    l.company,
    l.message,
  ]);

  const csv = toCsv(
    ["Date", "Name", "Phone", "Email", "Company", "Message"],
    rows,
  );

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${id}.csv"`,
    },
  });
}
