import { deleteAccount, signedInRecently } from "@/lib/account-deletion";
import { bearerToken, requestUser } from "@/lib/api/request-user";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/app/v1/account/delete — the app's "Delete account" (PLAN.md §9 W7,
 * Apple 5.1.1(v), Google Play's account deletion policy).
 *
 * Deletes the caller's own account: the user comes from their Bearer token,
 * checked by Supabase Auth, never from the body. The token must come from a
 * sign-in in the last ten minutes, so a phone left unlocked cannot delete a
 * business. What is deleted and what is kept is delete_account() (0033).
 *
 *   202 { scope: "account" | "member" }   done; the session is now invalid
 *   401 { code: "unauthorized" }
 *   403 { code: "reauthenticate" }        sign in again first
 *   403 { code: "staff" }                 Hornbill staff are removed by an admin
 *   404 { code: "not_found" }
 *   503 { code: "unavailable" }           the database is behind this deploy
 *   500 { code: "error" }                 safe to retry
 */

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requestUser(request);
  if (!auth) return json(401, { code: "unauthorized" });

  // requestUser accepted this token, so its claims can be read.
  const token = bearerToken(request)!;
  if (!signedInRecently(token)) return json(403, { code: "reauthenticate" });

  const result = await deleteAccount(createAdminClient(), auth.user.id);
  if (result.ok) return json(202, { scope: result.scope });

  switch (result.code) {
    case "staff":
      return json(403, { code: "staff" });
    case "not_found":
      return json(404, { code: "not_found" });
    case "schema_pending":
      return json(503, { code: "unavailable" });
    case "error":
      console.error("account deletion failed", { userId: auth.user.id, message: result.message });
      return json(500, { code: "error" });
  }
}
