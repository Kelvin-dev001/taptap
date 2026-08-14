import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Refreshes the Supabase auth session on protected routes so server components
// see a valid user. Scoped by the matcher in middleware.ts to app areas only —
// it deliberately does NOT run on the public tap/redirect path.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Turn requests away at the edge rather than letting page code run
  // unauthenticated. Layouts and pages render concurrently in the App Router,
  // so a redirect in the dashboard layout does not stop a page from executing
  // its queries first — this does.
  if (!user) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/login";
    // Drop the original query string — dashboard params like ?range=30 mean
    // nothing on the sign-in page.
    signIn.search = "";
    const redirectResponse = NextResponse.redirect(signIn);
    // Carry over any refreshed auth cookies set above.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}
