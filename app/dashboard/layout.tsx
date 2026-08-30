import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadBillingContext } from "@/lib/billing-context";
import { AppShell } from "@/components/shell/app-shell";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * One auth check and one workspace fetch for every dashboard route, so pages
 * stop repeating `getUser()` + redirect and the shell always has real identity
 * to render.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Both are RLS-scoped to the caller's account.
  const [{ data: profile }, { data: pages }] = await Promise.all([
    supabase.from("profiles").select("account_id").eq("id", user.id).single(),
    supabase
      .from("smart_pages")
      .select("id, slug, title")
      .order("created_at", { ascending: false }),
  ]);

  // The sidebar shows what the account can actually use today, not what it once
  // bought — a lapsed device must stop reading as an active one (D-018).
  const billing = await loadBillingContext(supabase, profile?.account_id);
  const renewsOn = billing.summary.renewsOn
    ? new Date(billing.summary.renewsOn).toLocaleDateString()
    : null;

  return (
    <AppShell
      businessName={billing.businessName}
      email={user.email ?? ""}
      segment={billing.segment}
      summary={billing.summary}
      renewsOn={renewsOn}
      profiles={pages ?? []}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
