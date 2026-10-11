import { requestUser } from "@/lib/api/request-user";
import { isUuid, parseDraftInput } from "@/lib/draft";
import { saveDraft } from "@/lib/page-draft";

/**
 * PUT /api/app/v1/pages/{id}/draft — the mobile app's autosave
 * (docs/mobile/PLAN.md §8 Editor, §9 W5).
 *
 * The same save as the web editor's (lib/page-draft.ts), so the lead-form rule
 * and destination checks exist once, however old the installed app is.
 *
 *   200 { updatedAt }
 *   400 { code: "invalid_body", field }
 *   401 { code: "unauthorized" }
 *   404 { code: "not_found" }                 not a profile of this account
 *   409 { code: "conflict", updatedAt }       saved elsewhere since; theirs is updatedAt
 *   422 { code: "invalid_destination", index } | { code: "invalid_redirect" } | { code: "invalid_block" }
 *   503 { code: "unavailable" }                the database is behind this deploy
 *
 * Versioned in the path: installed apps stay old for months, so a change that
 * breaks this contract gets a v2 beside it rather than replacing it.
 */

export const dynamic = "force-dynamic";

/** A full draft of 100 long actions is well under this; anything bigger is not a draft. */
const MAX_BODY_BYTES = 256 * 1024;

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requestUser(request);
  if (!auth) return json(401, { code: "unauthorized" });

  const { id } = await params;
  if (!isUuid(id)) return json(404, { code: "not_found" });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return json(400, { code: "invalid_body", field: "body" });

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json(400, { code: "invalid_body", field: "body" });
    body = JSON.parse(raw);
  } catch {
    return json(400, { code: "invalid_body", field: "body" });
  }

  const parsed = parseDraftInput(body);
  if (!parsed.ok) return json(400, { code: "invalid_body", field: parsed.field });
  // The app never switches a profile between page and redirect (PLAN.md §6),
  // so the profile keeps its own type whatever the body says.
  const result = await saveDraft(auth.supabase, id, { ...parsed.input, mode: undefined });
  if (result.ok) return json(200, { updatedAt: result.updatedAt });

  switch (result.code) {
    case "conflict":
      return json(409, { code: "conflict", updatedAt: result.updatedAt });
    case "not_found":
      return json(404, { code: "not_found" });
    case "invalid_destination":
      return json(422, { code: "invalid_destination", index: result.index });
    case "invalid_redirect":
    case "invalid_block":
      return json(422, { code: result.code });
    case "schema_pending":
      return json(503, { code: "unavailable" });
    case "error":
      console.error("app draft save failed", { pageId: id, message: result.message });
      return json(500, { code: "error" });
  }
}
