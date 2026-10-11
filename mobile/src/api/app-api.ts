import { env } from "@/config/env";
import { supabase } from "./supabase";

/**
 * Calls to the website's app routes, `/api/app/v1/…` (PLAN.md §4.1 #3): writes
 * that carry business rules run there, as the signed-in person, with their
 * Supabase access token as a Bearer header. No secret ever ships in the app.
 */

/** The server answered. `status` and `body` are whatever it sent. */
export type ApiAnswer = { status: number; body: Record<string, unknown> };

/**
 * The request never got an answer — offline, timed out, or the connection
 * dropped. Repeating it is up to the caller; for a draft save it is harmless.
 */
export class NetworkError extends Error {
  constructor(readonly reason: "offline" | "timeout") {
    super(`Request failed: ${reason}`);
    this.name = "NetworkError";
  }
}

/** No signed-in session to send. The session layer decides what happens next. */
export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedInError";
  }
}

const TIMEOUT_MS = 15_000;

export async function callAppApi(
  method: "PUT" | "POST",
  path: string,
  body: unknown,
  fetcher: typeof fetch = fetch,
): Promise<ApiAnswer> {
  // getSession() refreshes an expired access token first when it can.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new NotSignedInError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetcher(`${env.siteUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError(controller.signal.aborted ? "timeout" : "offline");
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // A proxy's HTML error page, or an empty body: the status still says enough.
  }
  const answer =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return { status: response.status, body: answer };
}
