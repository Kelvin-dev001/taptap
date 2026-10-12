import { assetLinks } from "@/lib/app-links";

/**
 * GET /.well-known/assetlinks.json — tells Android which apps may open this
 * site's links (PLAN.md §9 W10). Which paths they open is the app's own intent
 * filter (mobile/app.config.ts), kept equal to lib/app-links.ts by a test.
 *
 * Android fetches this when the app is installed. It must be served as JSON,
 * with a 200 and no redirect.
 */
export function GET() {
  return Response.json(assetLinks(), {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
