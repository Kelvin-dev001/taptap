import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";
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

  // All three are RLS-scoped to the caller's account.
  const [{ data: profile }, { data: sub }, { data: pages }] = await Promise.all([
    supabase.from("profiles").select("account_id").eq("id", user.id).single(),
    supabase.from("subscriptions").select("plan_code, current_period_end").maybeSingle(),
    supabase
      .from("smart_pages")
      .select("id, slug, title")
      .order("created_at", { ascending: false }),
  ]);

  const { data: account } = profile
    ? await supabase.from("accounts").select("name").eq("id", profile.account_id).single()
    : { data: null };

  const plan = planFor(sub?.plan_code);
  const renewsOn = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : null;

  return (
    <AppShell
      businessName={account?.name ?? "My business"}
      email={user.email ?? ""}
      plan={plan}
      renewsOn={renewsOn}
      profiles={pages ?? []}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
