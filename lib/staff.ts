import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";
import { isMissingSchemaError } from "./schema-guard";

export type StaffRole = "ops" | "admin";

export type StaffContext = {
  userId: string;
  email: string;
  role: StaffRole;
};

/**
 * Server-side staff gate for the `/admin` area (D-020).
 *
 * Replaces the shared `ADMIN_TOKEN` as the way in. That token is a single secret
 * with no identity — it cannot answer "who moved this order", which makes the
 * `order_events` audit log worthless — and its rate limiter is in-memory per
 * serverless instance. It survives as a SECOND factor on minting, which is the
 * one genuinely destructive action here.
 *
 * Redirects rather than rendering a 403: a signed-out person needs the login
 * page, and a signed-in non-staff person has no business knowing this area
 * exists. Both land somewhere useful instead of a dead end.
 */
export async function requireStaff(): Promise<StaffContext> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data, error } = await supabase
    .from("staff")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  // Pre-0017 the table does not exist. Failing CLOSED here is the opposite of
  // the choice made for billing entitlements, and deliberately so: over-granting
  // a customer capability for a few minutes is a shrug, over-granting access to
  // every customer's orders is not.
  if (isMissingSchemaError(error)) redirect("/dashboard");
  if (!data) redirect("/dashboard");

  return {
    userId: user.id,
    email: user.email ?? "",
    role: (data.role as StaffRole) ?? "ops",
  };
}
