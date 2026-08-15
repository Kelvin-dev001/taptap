import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`, with the
 * exported function renamed to match. Deferred through the UI sprints because
 * it sits on the authentication path and deserved a deliberate change rather
 * than a drive-by rename.
 *
 * Behaviour is unchanged: refresh the Supabase session, and turn unauthenticated
 * requests away before any page code runs (see lib/supabase/middleware.ts for
 * why that guard exists).
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Only run on authenticated app areas. The public tap/redirect path (top-level
// slugs) is intentionally excluded to keep taps fast.
export const config = {
  matcher: ["/dashboard/:path*"],
};
