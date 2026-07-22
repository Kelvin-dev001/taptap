import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// Only run on authenticated app areas. The public tap/redirect path (top-level
// slugs) is intentionally excluded to keep taps fast.
export const config = {
  matcher: ["/dashboard/:path*"],
};
