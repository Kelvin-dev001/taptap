import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, Alert } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import SettingsForm from "./settings-form";
import NotificationsForm from "./notifications-form";
import { isMissingSchemaError } from "@/lib/schema-guard";
import type { BusinessProfile, NotifyPrefs } from "./actions";

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

  // `notify` only exists once migration 0014 is applied. Selecting it on an
  // un-migrated database would break the whole Settings page rather than the one
  // card that needs it, so fall back the way profile creation already does.
  const { data: account, error: accountError } = me
    ? await supabase
        .from("accounts")
        .select("name, profile, notify")
        .eq("id", me.account_id)
        .single()
    : { data: null, error: null };

  const { data: legacyAccount } = isMissingSchemaError(accountError) && me
    ? await supabase.from("accounts").select("name, profile").eq("id", me.account_id).single()
    : { data: null };

  const resolved = account ?? legacyAccount;
  const notifyReady = !isMissingSchemaError(accountError);

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
            name={resolved?.name ?? ""}
            profile={(resolved?.profile ?? {}) as BusinessProfile}
          />
        </Card>

        <Card padding="md">
          <h2 className="mb-1 text-section-title text-foreground">Notifications</h2>
          <p className="mb-4 text-body-sm text-muted">
            A lead is only worth capturing if someone follows it up.
          </p>
          {notifyReady ? (
            <NotificationsForm
              notify={((account as { notify?: NotifyPrefs } | null)?.notify ?? {}) as NotifyPrefs}
              ownerEmail={user.email ?? ""}
            />
          ) : (
            <Alert tone="warning">
              Run migration <code>0014_notifications.sql</code> to turn on lead alerts.
            </Alert>
          )}
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
