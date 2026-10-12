import { appleAppSiteAssociation } from "@/lib/app-links";

/**
 * GET /.well-known/apple-app-site-association — tells iOS which links the app
 * may open (PLAN.md §9 W10). No file extension, served as JSON, a 200 and no
 * redirect: Apple's CDN fetches it, not the phone.
 *
 * 404 until Apple's Team ID is known (lib/app-links.ts), so until then iOS
 * opens every link in Safari.
 */
export function GET() {
  const file = appleAppSiteAssociation();
  if (!file) return new Response("Not found", { status: 404 });
  return Response.json(file, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
