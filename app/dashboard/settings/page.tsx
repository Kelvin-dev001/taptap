import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, Alert } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import SettingsForm from "./settings-form";
import type { BusinessProfile } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // A page cannot lean on the layout's auth check: layouts and pages render
  // concurrently, so this runs even while the layout is redirecting.
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();

  const { data: account } = me
    ? await supabase.from("accounts").select("name, profile").eq("id", me.account_id).single()
    : { data: null };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your business details. These will pre-fill new Tap Profiles."
      />

      <div className="flex max-w-2xl flex-col gap-5">
        <Card padding="md">
          <h2 className="mb-4 text-section-title text-foreground">Business details</h2>
          <SettingsForm
            name={account?.name ?? ""}
            profile={(account?.profile ?? {}) as BusinessProfile}
          />
        </Card>

        <Card padding="md">
          <h2 className="mb-2 text-section-title text-foreground">Account</h2>
          <p className="text-body-sm text-muted">
            Signed in as <span className="text-foreground">{user?.email}</span>
          </p>
          <Alert tone="info" className="mt-4">
            Changing your email or password, and inviting teammates, are not available yet.
          </Alert>
        </Card>
      </div>
    </>
  );
}
